import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Doubt from "@/models/Doubt";
import User from "@/models/user.model";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function retryWithBackoff(fn, maxRetries = 3, delayMs = 1200) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt === maxRetries) throw e;
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
}

async function generateAIMentorAnswer(payload) {
  const { questionText, userAnswer, correctAnswer, confusion } = payload;
  const prompt = `You are a friendly AI mentor. Explain the correct reasoning for the following multiple-choice question.
Question: ${questionText}
Student's Answer: ${userAnswer}
Correct Answer: ${correctAnswer}
Student's confusion: ${confusion || "(not provided)"}

Write a concise, student-friendly explanation with:
- Why the correct answer is correct
- Why the student's answer may seem plausible but is incorrect
- A simple analogy or example
- A 3-5 step breakdown to arrive at the correct answer
Keep it under 180-220 words.`;

  const modelCandidates = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-2.0-flash-001",
    "gemini-2.0-flash-lite-001",
    "gemini-2.0-flash-lite",
  ];
  for (const modelName of modelCandidates) {
    try {
      const text = await retryWithBackoff(async () => {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return await response.text();
      });
      return text.replace(/```[\s\S]*?```/g, "").trim();
    } catch (e) {
      continue;
    }
  }
  // Signal pending for caller to mark UI if needed
  const fallback =
    "AI mentor is temporarily unavailable. Here's how to reason it: 1) Restate the question and identify the core concept. 2) Eliminate options that contradict the concept. 3) Compare your choice to the correct one and find the differentiator. 4) Re-derive the answer step-by-step. Try again in a minute for a detailed mentor explanation.";
  return fallback;
}

export async function GET(req) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const filter = {};
  if (searchParams.get("asker")) filter.asker = searchParams.get("asker");
  if (searchParams.get("tag")) filter.tags = searchParams.get("tag");

  const sort =
    searchParams.get("sort") === "trending"
      ? { totalUpvotes: -1, createdAt: -1 }
      : { createdAt: -1 };

  const doubts = await Doubt.find(filter)
    .sort(sort)
    .limit(100)
    .populate("asker", "name email")
    .lean();
  return NextResponse.json({ success: true, data: doubts });
}

export async function POST(req) {
  await dbConnect();
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await req.json();
  const {
    questionText,
    userAnswer,
    correctAnswer,
    confusion,
    tags,
    relatedTestResultId,
    relatedQuestionIndex,
  } = body;
  if (!questionText) {
    return NextResponse.json(
      { success: false, error: "questionText is required" },
      { status: 400 }
    );
  }

  const aiAnswer = await generateAIMentorAnswer({
    questionText,
    userAnswer,
    correctAnswer,
    confusion,
  });

  const doubt = await Doubt.create({
    asker: session.user.id,
    questionText,
    userAnswer,
    correctAnswer,
    confusion,
    tags: tags || [],
    aiAnswer,
    aiAnswerPending:
      !aiAnswer ||
      aiAnswer.toLowerCase().startsWith("ai mentor is temporarily unavailable"),
    relatedTestResultId,
    relatedQuestionIndex,
  });

  // Award small XP for posting a doubt
  await User.findByIdAndUpdate(session.user.id, { $inc: { totalXP: 10 } });

  return NextResponse.json({ success: true, data: doubt });
}
