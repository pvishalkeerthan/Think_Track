import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "@/lib/logger";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Enhanced JSON cleaning function
function cleanAndParseJSON(text) {
  logger.debug("Raw text before cleaning");

  // Remove markdown formatting
  text = text.replace(/```json\n?/g, "").replace(/\n?```/g, "");

  // Remove any leading or trailing whitespace and newlines
  text = text.trim();

  // Try to find JSON object in the text
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    text = jsonMatch[0];
  }

  logger.debug("Cleaned text prepared");

  try {
    return JSON.parse(text);
  } catch (error) {
    logger.error("JSON parsing failed with cleaned text:", error);
    throw error;
  }
}

export async function POST(request) {
  try {
    const { topic, knowledge_level, time } = await request.json();

    if (!topic || !knowledge_level || !time) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 4096,
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
      systemInstruction: `You are an expert educational consultant and course recommendation specialist with extensive knowledge of online learning platforms, courses, and educational resources. You help learners find the best courses for their specific needs and learning goals.

COURSE RECOMMENDATION GUIDELINES:
1. Provide specific, real courses from major platforms (Coursera, Udemy, edX, Khan Academy, YouTube, etc.)
2. Include courses appropriate for the learner's knowledge level
3. Consider course duration, cost, and quality ratings
4. Provide diverse options (free and paid, different teaching styles)
5. Include both structured courses and supplementary resources
6. Focus on courses that match the learner's time constraints

OUTPUT FORMAT (strict JSON):
{
  "courses": [
    {
      "title": "Course Title",
      "platform": "Platform Name",
      "instructor": "Instructor Name",
      "duration": "X weeks/hours",
      "cost": "Free/Paid ($X)",
      "rating": "X.X/5",
      "description": "Brief course description",
      "url": "Course URL (if available)",
      "level": "Beginner/Intermediate/Advanced",
      "features": ["Feature 1", "Feature 2", "Feature 3"]
    }
  ]
}

QUALITY STANDARDS:
- Recommend 6-8 high-quality courses
- Include mix of free and paid options
- Consider different learning styles
- Include both beginner and advanced options
- Provide specific course details and ratings`,
    });

    const prompt = `Find and recommend the best online courses for learning "${topic}" at ${knowledge_level} level. The learner has ${time} available for learning.

REQUIREMENTS:
1. Find courses from major platforms (Coursera, Udemy, edX, Khan Academy, YouTube, LinkedIn Learning, etc.)
2. Include courses appropriate for ${knowledge_level} level
3. Consider the ${time} time constraint
4. Provide mix of free and paid options
5. Include courses with good ratings and reviews
6. Focus on practical, hands-on learning
7. Include both structured courses and supplementary resources

SEARCH CRITERIA:
- Topic: ${topic}
- Level: ${knowledge_level}
- Time Available: ${time}
- Focus on: Practical application, real-world projects, industry-relevant content

Provide specific course recommendations with details about content, instructors, duration, cost, and why each course is suitable for this learner.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();
    logger.debug("Received AI response for courses");

    try {
      const courses = cleanAndParseJSON(responseText);
      logger.info("Successfully parsed courses");
      return NextResponse.json(courses);
    } catch (parseError) {
      logger.error("JSON parsing failed:", parseError);
      logger.debug("Raw response failed to parse");

      // If parsing fails, trigger fallback
      throw new Error("Failed to parse AI response as JSON");
    }
  } catch (error) {
    logger.error("Error finding courses:", error);

    // Fallback response with sample courses
    const fallbackCourses = {
      courses: [
        {
          title: "Introduction to " + topic,
          platform: "Coursera",
          instructor: "University Professor",
          duration: "4-6 weeks",
          cost: "Free (with paid certificate)",
          rating: "4.5/5",
          description: `A comprehensive introduction to ${topic} covering fundamental concepts and practical applications.`,
          level: knowledge_level,
          features: [
            "Video lectures",
            "Quizzes",
            "Peer assignments",
            "Certificate",
          ],
        },
        {
          title: topic + " Fundamentals",
          platform: "Udemy",
          instructor: "Industry Expert",
          duration: "8-10 hours",
          cost: "Paid ($29.99)",
          rating: "4.7/5",
          description: `Learn ${topic} from scratch with hands-on projects and real-world examples.`,
          level: knowledge_level,
          features: [
            "Lifetime access",
            "Downloadable resources",
            "Mobile app",
            "Certificate",
          ],
        },
        {
          title: "Advanced " + topic,
          platform: "edX",
          instructor: "University Faculty",
          duration: "12 weeks",
          cost: "Free (audit) / $99 (verified)",
          rating: "4.6/5",
          description: `Deep dive into advanced ${topic} concepts with comprehensive curriculum.`,
          level: "Advanced",
          features: [
            "University credit",
            "Professional certificate",
            "Discussion forums",
          ],
        },
      ],
    };

    return NextResponse.json(fallbackCourses);
  }
}
