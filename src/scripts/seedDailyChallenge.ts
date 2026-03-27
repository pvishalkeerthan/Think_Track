import mongoose from 'mongoose';
import path from 'path';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

// Relative imports for script execution
import DailyChallenge from '../models/DailyChallenge';

async function seedDailyChallenge() {
  await mongoose.connect(MONGODB_URI as string);
  console.log('Connected to MongoDB');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // @ts-ignore
  const existing = await DailyChallenge.findOne({
    expiresAt: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
  });

  if (existing) {
    console.log("Daily challenge already exists for today:", existing._id);
    await mongoose.disconnect();
    return;
  }

  // @ts-ignore
  const challenge = await DailyChallenge.create({
    topicName: "Frontend Web Development",
    topicSlug: "frontend-web-development",
    expiresAt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
    questions: [
      {
        questionText: "What does HTML stand for?",
        options: ["Hyper Text Markup Language", "High Text Machine Language", "Hyper Tabular Markup Language", "None of the above"],
        correctAnswer: "Hyper Text Markup Language",
        explanation: "HTML is the standard markup language for documents designed to be displayed in a web browser."
      },
      {
        questionText: "Which of these is a utility-first CSS framework?",
        options: ["React", "Express", "Tailwind", "MongoDB"],
        correctAnswer: "Tailwind",
        explanation: "Tailwind CSS is a utility-first CSS framework for rapidly building custom user interfaces."
      },
      {
        questionText: "What is the primary purpose of useEffect in React?",
        options: ["To style components", "To manage side effects", "To update state synchronously", "To route between pages"],
        correctAnswer: "To manage side effects",
        explanation: "useEffect is used to perform side effects in functional components, like data fetching, subscriptions, or manually changing the DOM."
      },
      {
        questionText: "Which method is used to selectively update the DOM in React?",
        options: ["Virtual DOM", "Shadow DOM", "Real DOM", "Document Node Mode"],
        correctAnswer: "Virtual DOM",
        explanation: "React uses a Virtual DOM to batch and optimize updates to the actual browser DOM."
      },
      {
        questionText: "In JavaScript, which operator is used for strict equality testing?",
        options: ["=", "==", "===", "=>"],
        correctAnswer: "===",
        explanation: "The strict equality operator (===) checks whether its two operands are equal, returning a Boolean result, without type conversion."
      }
    ],
    difficulty: "medium",
    bonusXP: 50,
    completedBy: [],
    globalAverageScore: 0,
    completionCount: 0
  });

  console.log("Seeded new daily challenge:", challenge._id);
  await mongoose.disconnect();
}

seedDailyChallenge().catch((error) => {
  console.error("Error seeding daily challenge:", error);
  process.exit(1);
});
