import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import DailyChallenge from '@/models/DailyChallenge';

export async function GET() {
  await dbConnect();
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
  
  const newChallenge = {
    topicName: "Web Development Basics",
    topicSlug: "web-development",
    difficulty: "easy",
    expiresAt,
    expiryDate: expiresAt,
    completedBy: [],
    bonusXP: 100,
    questions: [
      {
        questionText: "What does HTML stand for?",
        options: ["Hyper Text Markup Language", "High Tech Modern Language", "Hyper Link Markup Language", "Home Tool Markup Language"],
        correctAnswer: "Hyper Text Markup Language",
        explanation: "HTML is the standard markup language for creating web pages."
      },
      {
        questionText: "Which CSS property is used to change the text color?",
        options: ["font-color", "text-color", "color", "background-color"],
        correctAnswer: "color",
        explanation: "The 'color' property is used to set the color of the text."
      },
      {
        questionText: "What is the purpose of useEffect in React?",
        options: ["To update state", "To handle side effects", "To create components", "To use context"],
        correctAnswer: "To handle side effects",
        explanation: "useEffect lets you synchronize a component with an external system."
      }
    ]
  };

  try {
    const challenge = await (DailyChallenge as any).create(newChallenge);
    return NextResponse.json({ success: true, challenge });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as any).message }, { status: 500 });
  }
}
