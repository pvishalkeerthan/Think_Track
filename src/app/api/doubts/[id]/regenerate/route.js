import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Doubt from "@/models/Doubt";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "@/lib/logger";
import { recordUsage, getRemaining } from "@/lib/quota";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function retryWithBackoff(fn, maxRetries = 3, delayMs = 1200) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fn();
      logger.debug("[Regenerate] Attempt", attempt, "success");
      return res;
    } catch (e) {
      logger.warn("[Regenerate] Attempt", attempt, "failed:", e?.message || e);
      if (attempt === maxRetries) throw e;
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
}

async function generateAIMentorAnswer(d) {
  const prompt = `You are a friendly AI mentor. Explain the correct reasoning for the following multiple-choice question.
Question: ${d.questionText}
Student's Answer: ${d.userAnswer || "(not provided)"}
Correct Answer: ${d.correctAnswer || "(not provided)"}
Student's confusion: ${d.confusion || "(not provided)"}

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
  return "AI mentor is temporarily unavailable. Reason it out: 1) Identify the tested concept. 2) Discard options contradicting it. 3) Contrast your choice vs correct option and find the key difference. 4) Re-derive step-by-step. Try regenerate again shortly.";
}

export async function POST(_req, { params }) {
  await dbConnect();
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const doubt = await Doubt.findById(params.id);
  if (!doubt)
    return NextResponse.json(
      { success: false, error: "Not found" },
      { status: 404 }
    );

  logger.info("[Regenerate] Start for doubt", params.id);
  const ai = await generateAIMentorAnswer(doubt);
  // Estimate remaining Gemini requests if GEMINI_HOURLY_QUOTA is set
  recordUsage("gemini", 1);
  const remaining = getRemaining("gemini", "GEMINI_HOURLY_QUOTA");
  if (remaining !== null) {
    logger.info(`Gemini estimated remaining this hour: ${remaining}`);
  }
  doubt.aiAnswer = ai;
  doubt.aiAnswerPending =
    !ai || ai.toLowerCase().startsWith("ai mentor is temporarily unavailable");
  await doubt.save();
  logger.info("[Regenerate] Done, length:", ai?.length || 0);
  return NextResponse.json({ success: true, data: { aiAnswer: ai } });
}
