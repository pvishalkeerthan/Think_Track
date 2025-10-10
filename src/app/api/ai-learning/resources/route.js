import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(request) {
  try {
    const { course, knowledge_level, description, time } = await request.json();

    if (!course || !knowledge_level || !description || !time) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 1,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 8192,
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
      ],
      systemInstruction: `You are an expert educational content creator and instructional designer with 20+ years of experience in creating comprehensive, engaging learning materials. Your expertise spans all domains and you excel at making complex topics accessible and practical.

CONTENT CREATION GUIDELINES:
1. Create comprehensive, well-structured learning materials
2. Use clear, engaging language appropriate for the learner's level
3. Include practical examples, real-world applications, and hands-on exercises
4. Provide step-by-step guidance with actionable instructions
5. Include visual aids descriptions and learning checkpoints
6. Address common misconceptions and learning challenges
7. Make content interactive and engaging

CONTENT STRUCTURE:
- Learning Objectives (what they'll achieve)
- Prerequisites (what they need to know first)
- Core Concepts (detailed explanations)
- Practical Examples (real-world applications)
- Hands-on Exercises (practice activities)
- Common Pitfalls (mistakes to avoid)
- Next Steps (what to learn next)
- Additional Resources (further learning)

FORMATTING:
- Use clear headings and subheadings
- Include bullet points and numbered lists
- Add emphasis for key concepts
- Use code blocks for technical content
- Include practical tips and best practices
- Make content scannable and digestible

Create content that is educational, practical, and immediately actionable for the learner.`,
    });

    const prompt = `Create comprehensive, high-quality learning resources for the following scenario:

LEARNING CONTEXT:
- Course: ${course}
- Knowledge Level: ${knowledge_level}
- Specific Topic: ${description}
- Expected Learning Time: ${time}

RESOURCE REQUIREMENTS:
1. Create detailed, structured learning materials that cover "${description}" comprehensively
2. Tailor content complexity and depth to ${knowledge_level} level
3. Include practical, hands-on learning activities
4. Provide clear learning objectives and outcomes
5. Include real-world examples and applications
6. Address common learning challenges and misconceptions
7. Make content engaging and immediately actionable

CONTENT SHOULD INCLUDE:
- Clear learning objectives and prerequisites
- Step-by-step explanations with examples
- Practical exercises and hands-on activities
- Real-world applications and use cases
- Common pitfalls and how to avoid them
- Assessment checkpoints and progress indicators
- Additional resources for deeper learning
- Tips for effective learning and retention

FORMAT: Use clear markdown formatting with headings, bullet points, code blocks (if applicable), and emphasis for key concepts.

Create content that will help a ${knowledge_level} learner master "${description}" effectively within ${time}.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const resources = response.text();

    return NextResponse.json({ content: resources });
  } catch (error) {
    console.error("Error generating resources:", error);
    return NextResponse.json(
      { error: "Failed to generate resources" },
      { status: 500 }
    );
  }
}
