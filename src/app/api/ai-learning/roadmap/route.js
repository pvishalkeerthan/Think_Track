export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { unifiedInference, cleanAIJsonResponse } from "@/lib/inference";

export async function POST(request) {
  try {
    const { topic, time, knowledge_level } = await request.json();

    if (!topic || !time || !knowledge_level) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const config = {
      generationConfig: {
        temperature: 1,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 4000,
        responseMimeType: "application/json",
      },
      systemInstruction: `You are an expert curriculum designer. Output strict JSON. 
      Format: { "week 1": { "topic": "Name", "subtopics": [{ "subtopic": "Name", "time": "X", "description": "Details" }] } }.
      Keep all keys lowercase: subtopics, topic, time, description.`,
    };

    const prompt = `Create a learning roadmap for "${topic}".
    Time: ${time}
    Level: ${knowledge_level}
    Weekly commitment: 16 hours.
    For ${knowledge_level}, focus on: ${
      knowledge_level === "Absolute Beginner" ? "Foundations" : "Application"
    }.`;

    const responseText = await unifiedInference(prompt, config);
    const cleanJson = cleanAIJsonResponse(responseText);
    const roadmap = JSON.parse(cleanJson);

    return NextResponse.json(roadmap);
  } catch (error) {
    console.error("Fatal Roadmap Error:", error);
    return NextResponse.json(
      { 
        error: "Failed to generate roadmap", 
        details: error.message 
      }, 
      { status: 500 }
    );
  }
}
