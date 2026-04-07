export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { unifiedInference } from "@/lib/inference";

export async function POST(request) {
  try {
    const { course, knowledge_level, description, time } = await request.json();

    if (!course || !knowledge_level || !description || !time) {
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
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      ],
      systemInstruction: `You are an expert instructional designer. Create comprehensive, high-quality learning resources in Markdown format.
      Include: Learning Objectives, Prerequisites, Core Concepts, Practical Examples, Hands-on Exercises, Common Pitfalls, and Next Steps.`,
    };

    const prompt = `Create learning resources for:
    COURSE: ${course}
    LEVEL: ${knowledge_level}
    TOPIC: ${description}
    TIME: ${time}
    Provide detailed, step-by-step guidance in clear Markdown.`;

    const resourcesText = await unifiedInference(prompt, config);

    return NextResponse.json({ content: resourcesText });
  } catch (error) {
    console.error("Error generating resources:", error);
    return NextResponse.json(
      { 
        error: "Failed to generate resources", 
        details: error.message 
      }, 
      { status: 500 }
    );
  }
}
