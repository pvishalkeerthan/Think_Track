import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(request) {
  try {
    const { course, topic, subtopic, description } = await request.json();

    if (!course || !topic || !subtopic || !description) {
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
        maxOutputTokens: 20000,
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
      systemInstruction: `You are an expert educational assessment specialist with 20+ years of experience in creating comprehensive, pedagogically sound quizzes and assessments. Your expertise covers all academic and professional domains.

QUIZ CREATION GUIDELINES:
1. Create questions that test both factual knowledge and conceptual understanding
2. Include questions at different cognitive levels: Remember, Understand, Apply, Analyze, Evaluate, Create
3. Ensure questions are clear, unambiguous, and have only one correct answer
4. Make distractors (wrong options) plausible but clearly incorrect
5. Include practical application questions and real-world scenarios
6. Vary question difficulty to challenge learners appropriately
7. Include questions that require critical thinking and problem-solving

QUESTION TYPES TO INCLUDE:
- Conceptual understanding (30%)
- Practical application (40%)
- Problem-solving scenarios (20%)
- Critical thinking/analysis (10%)

OUTPUT FORMAT (strict JSON):
{
  "questions": [
    {
      "question": "Clear, specific question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answerIndex": 0,
      "reason": "Detailed explanation of why this answer is correct and why others are wrong"
    }
  ]
}

QUALITY STANDARDS:
- Questions should be specific to the subtopic content
- Include 5-8 questions for comprehensive coverage
- Each question should test different aspects of the learning material
- Explanations should be educational and help reinforce learning
- Avoid trick questions or overly complex wording`,
    });

    const prompt = `Create a comprehensive quiz for the following learning scenario:

COURSE CONTEXT:
- Course: ${course}
- Current Topic: ${topic}
- Focus Subtopic: ${subtopic}
- Learning Description: ${description}

QUIZ REQUIREMENTS:
1. Create 6-8 high-quality multiple choice questions that thoroughly test understanding of "${subtopic}"
2. Questions should cover both theoretical knowledge and practical application
3. Include questions that test:
   - Core concepts and definitions
   - Practical implementation
   - Problem-solving scenarios
   - Common mistakes and misconceptions
   - Real-world applications

4. Ensure each question has:
   - Clear, unambiguous wording
   - 4 plausible answer options
   - One clearly correct answer
   - Detailed explanation of the correct answer

5. Make questions progressively challenging but appropriate for someone learning this subtopic
6. Include at least one question that requires critical thinking or analysis
7. Focus on practical understanding rather than memorization

Generate questions that will help the learner assess their mastery of "${subtopic}" and identify areas for improvement.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const quiz = JSON.parse(response.text());

    return NextResponse.json(quiz);
  } catch (error) {
    console.error("Error generating quiz:", error);
    return NextResponse.json(
      { error: "Failed to generate quiz" },
      { status: 500 }
    );
  }
}
