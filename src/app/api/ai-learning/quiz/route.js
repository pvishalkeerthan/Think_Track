export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import CommunityQuestion from "@/models/CommunityQuestion";
import dbConnect from "@/lib/dbConnect";
import { unifiedInference, cleanAIJsonResponse } from "@/lib/inference";

export async function POST(request) {
  try {
    const { course, topic, subtopic, description } = await request.json();

    if (!course || !topic || !subtopic || !description) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const config = {
      generationConfig: {
        temperature: 1,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 4000,
        responseMimeType: "application/json",
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      ],
      systemInstruction: `You are an expert assessment specialist. Output strict JSON.
      Format: { "questions": [ { "question": "...", "options": ["...", "..."], "answerIndex": 0, "reason": "..." } ] }.
      Create 6-8 high-quality questions for "${subtopic}".`,
    };

    const prompt = `Create a comprehensive quiz for:
    COURSE: ${course}
    TOPIC: ${topic}
    SUBTOPIC: ${subtopic}
    LEARNING CONTENT: ${description}
    Return 6-8 multiple choice questions.`;

    const responseText = await unifiedInference(prompt, config);
    const cleanJson = cleanAIJsonResponse(responseText);
    const quiz = JSON.parse(cleanJson);

    // MIX IN COMMUNITY QUESTIONS
    try {
      await dbConnect();
      const communityQuestions = await CommunityQuestion.find({
        topic: { $regex: new RegExp(topic, "i") },
        approved: true
      }).limit(3).lean();

      if (communityQuestions && communityQuestions.length > 0) {
        const formattedCommunity = communityQuestions.map(q => ({
          question: q.questionText,
          options: q.options,
          answerIndex: q.options.indexOf(q.correctAnswer),
          reason: "Community contributed and vetted question."
        })).filter(q => q.answerIndex !== -1);

        quiz.questions = [...formattedCommunity.slice(0, 2), ...quiz.questions].slice(0, 8);
      }
    } catch (dbErr) {
      console.warn("Could not fetch community questions for mix-in:", dbErr);
    }

    return NextResponse.json(quiz);
  } catch (error) {
    console.error("Error generating quiz:", error);
    return NextResponse.json(
      { 
        error: "Failed to generate quiz", 
        details: error.message 
      }, 
      { status: 500 }
    );
  }
}
