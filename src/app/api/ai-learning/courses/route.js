export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { unifiedInference, cleanAIJsonResponse } from "@/lib/inference";

/**
 * Enhanced JSON cleaning function with robust error handling
 */
function cleanAndParseJSON(text) {
  const originalText = text;
  logger.debug("Raw text before cleaning, length:", text.length);

  // Use the shared cleaner first
  text = cleanAIJsonResponse(text);
  
  // Remove markdown formatting
  text = text.replace(/```json\n?/g, "").replace(/\n?```/g, "");

  // Remove any leading or trailing whitespace and newlines
  text = text.trim();

  // Try to find JSON object in the text - look for the outermost object
  let jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    text = jsonMatch[0];
  } else {
    // If no object found, try to find array
    jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      text = jsonMatch[0];
    }
  }

  logger.debug("Cleaned text prepared, length:", text.length);

  try {
    const parsed = JSON.parse(text);
    
    // Validate structure
    if (parsed && typeof parsed === 'object') {
      // If it's an array, wrap it in courses
      if (Array.isArray(parsed)) {
        return { courses: parsed };
      }
      // If it has courses property, return as is
      if (parsed.courses && Array.isArray(parsed.courses)) {
        return parsed;
      }
    }
    
    return parsed;
  } catch (error) {
    // Enhanced error logging with context
    const errorPosition = error.message.match(/position (\d+)/);
    const position = errorPosition ? parseInt(errorPosition[1]) : null;
    
    logger.error("JSON parsing failed:", {
      error: error.message,
      position: position,
      textLength: text.length,
      problematicText: position 
        ? text.substring(Math.max(0, position - 100), Math.min(text.length, position + 100))
        : text.substring(0, 500),
      fullText: text.substring(0, 2000), // First 2000 chars for debugging
    });
    
    // Try to fix common JSON issues
    try {
      // Remove trailing commas before closing braces/brackets
      let fixedText = text.replace(/,(\s*[}\]])/g, '$1');
      
      // Fix unescaped quotes in strings (basic attempt)
      fixedText = fixedText.replace(/([{,]\s*"[^"]*)"([^"]*"[^"]*":)/g, '$1\\"$2');
      
      const parsed = JSON.parse(fixedText);
      logger.info("Successfully parsed after fixing common issues");
      
      if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed)) {
          return { courses: parsed };
        }
        if (parsed.courses && Array.isArray(parsed.courses)) {
          return parsed;
        }
      }
      
      return parsed;
    } catch (fixError) {
      logger.error("Failed to fix JSON, throwing original error");
      throw new Error(`JSON parsing error at position ${position || 'unknown'}: ${error.message}. Problematic text: ${position ? text.substring(Math.max(0, position - 50), Math.min(text.length, position + 50)) : 'see logs'}`);
    }
  }
}

export async function POST(request) {
  let topic, knowledge_level, time;
  
  try {
    const body = await request.json();
    topic = body.topic;
    knowledge_level = body.knowledge_level;
    time = body.time;

    if (!topic || !knowledge_level || !time) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const config = {
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      ],
      systemInstruction: `You are an expert educational consultant. Output strict JSON only.
      Format: { "courses": [ { "title": "...", "platform": "...", "instructor": "...", "duration": "...", "cost": "...", "rating": "...", "description": "...", "courseUrl": "...", "level": "...", "features": ["..."] } ] }
      Recommend 6-8 high-quality courses for learnining "${topic}" at ${knowledge_level} level.`,
    };

    const prompt = `Recommend at least 6 online courses for:
    TOPIC: ${topic}
    LEVEL: ${knowledge_level}
    TIME: ${time}
    Include platforms like Coursera, Udemy, edX, YouTube. For each course, provide a real, accessible URL (or platform search URL).`;

    const responseText = await unifiedInference(prompt, config);
    logger.debug("Received AI response for courses");

    try {
      const coursesData = cleanAndParseJSON(responseText);
      logger.info("Successfully parsed courses");
      return NextResponse.json(coursesData);
    } catch (parseError) {
      logger.error("JSON parsing failed, returning fallback:", parseError);
      throw parseError; // Caught by outer block for fallback
    }
  } catch (error) {
    logger.error("Error finding courses, returning fallback:", error);

    const fallbackTopic = topic || "the subject";
    const fallbackLevel = knowledge_level || "Beginner";
    
    const fallbackCourses = {
      courses: [
        {
          title: "Introduction to " + fallbackTopic,
          platform: "Coursera",
          instructor: "University Professor",
          duration: "4-6 weeks",
          cost: "Free (with paid certificate)",
          rating: "4.5/5",
          description: `A comprehensive introduction to ${fallbackTopic} covering fundamental concepts and practical applications.`,
          courseUrl: "https://www.coursera.org/search?query=" + encodeURIComponent(fallbackTopic),
          level: fallbackLevel,
          features: ["Video lectures", "Quizzes", "Peer assignments", "Certificate"],
        },
        {
          title: fallbackTopic + " Fundamentals",
          platform: "Udemy",
          instructor: "Industry Expert",
          duration: "8-10 hours",
          cost: "Paid ($29.99)",
          rating: "4.7/5",
          description: `Learn ${fallbackTopic} from scratch with hands-on projects and real-world examples.`,
          courseUrl: "https://www.udemy.com/courses/search/?q=" + encodeURIComponent(fallbackTopic),
          level: fallbackLevel,
          features: ["Lifetime access", "Downloadable resources", "Mobile app", "Certificate"],
        }
      ],
    };

    return NextResponse.json(fallbackCourses);
  }
}
