export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Doubt from "@/models/Doubt";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/authOptions';
import { unifiedInference } from "@/lib/inference";

async function generateAIMentorAnswer(payload) {
  const { questionText, userAnswer, correctAnswer, confusion } = payload;
  
  const config = {
    systemInstruction: "You are a friendly AI mentor. Provide clear, student-friendly explanations that help learners understand concepts deeply.",
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1000,
    }
  };

  const prompt = `Explain the correct reasoning for the following multiple-choice question.
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

  try {
    const text = await unifiedInference(prompt, config);
    // Simple cleaning of code blocks if any
    return text.replace(/```[\s\S]*?```/g, "").trim();
  } catch (error) {
    console.error("Inference failed for AI Mentor:", error);
    return "AI mentor is temporarily unavailable. Please try again in a minute for a detailed explanation.";
  }
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

  return NextResponse.json({ success: true, data: doubt });
}
