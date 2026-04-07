export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Doubt from "@/models/Doubt";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/authOptions';
import { logger } from "@/lib/logger";
import { recordUsage, getRemaining } from "@/lib/quota";
import { unifiedInference } from "@/lib/inference";

async function generateAIMentorAnswer(d) {
  const config = {
    systemInstruction: "You are a friendly AI mentor. Provide clear, student-friendly explanations that help learners understand concepts deeply.",
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1000,
    }
  };

  const prompt = `Explain the correct reasoning for the following multiple-choice question.
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

  try {
    const text = await unifiedInference(prompt, config);
    return text.replace(/```[\s\S]*?```/g, "").trim();
  } catch (error) {
    logger.error("[Regenerate] Inference failed:", error);
    return "AI mentor is temporarily unavailable. Try again shortly.";
  }
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
  
  // Estimate remaining Gemini requests if any quota system is in place
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
