import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(request) {
  try {
    const { topic, time, knowledge_level } = await request.json();

    if (!topic || !time || !knowledge_level) {
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
        responseMimeType: "application/json",
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
      systemInstruction: `You are an expert educational consultant and curriculum designer with 15+ years of experience in creating comprehensive learning paths. Your expertise spans across all domains including technology, sciences, arts, business, and practical skills.

CRITICAL REQUIREMENTS:
1. Create a structured, progressive learning path that builds knowledge systematically
2. Each subtopic must be specific, actionable, and measurable
3. Time estimates should be realistic based on the complexity and learner's level
4. Include practical applications and real-world examples
5. Ensure proper sequencing - prerequisites before advanced topics
6. Consider different learning styles (visual, auditory, kinesthetic)
7. Include assessment checkpoints and practice opportunities

OUTPUT FORMAT (strict JSON):
{
  "week 1": {
    "topic": "Foundation Topic Name",
    "subtopics": [
      {
        "subtopic": "Specific Learning Objective",
        "time": "X hours/days",
        "description": "Detailed learning goals, what to practice, key concepts to master, and expected outcomes"
      }
    ]
  }
}

GUIDELINES:
- For beginners: Start with fundamentals, include hands-on practice
- For intermediate: Build on existing knowledge, focus on application
- For advanced: Deep dive into complex concepts, real-world projects
- Time allocation: 60% theory, 40% practice
- Include both conceptual understanding and practical skills
- Make descriptions actionable with clear learning objectives

Keep all keys lowercase: subtopics, topic, time, description`,
    });

    const prompt = `Create a comprehensive, personalized learning roadmap for "${topic}" with the following specifications:

LEARNER PROFILE:
- Topic: ${topic}
- Available Time: ${time}
- Current Knowledge Level: ${knowledge_level}
- Weekly Study Time: 16 hours (distributed across 4-5 days)

REQUIREMENTS:
1. Create a progressive curriculum that builds from fundamentals to advanced concepts
2. Each week should have 3-5 focused subtopics with clear learning objectives
3. Include hands-on practice, projects, and real-world applications
4. Provide specific time estimates for each subtopic (be realistic)
5. Ensure proper prerequisite sequencing
6. Include both theoretical understanding and practical skills
7. Consider the learner's current level and adapt complexity accordingly

For ${knowledge_level} level learners, focus on:
- ${
      knowledge_level === "Absolute Beginner"
        ? "Foundational concepts, basic terminology, and simple hands-on exercises"
        : knowledge_level === "Beginner"
        ? "Building on basics with practical applications and guided projects"
        : knowledge_level === "Moderate"
        ? "Intermediate concepts with real-world projects and problem-solving"
        : "Advanced topics with complex projects, research, and mastery-level applications"
    }

Generate a detailed, actionable roadmap that will take the learner from their current level to proficiency in ${topic} within ${time}.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const roadmap = JSON.parse(response.text());

    return NextResponse.json(roadmap);
  } catch (error) {
    console.error("Error generating roadmap:", error);
    return NextResponse.json(
      { error: "Failed to generate roadmap" },
      { status: 500 }
    );
  }
}
