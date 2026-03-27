export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import DailyChallenge from '@/models/DailyChallenge';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { calculateXP } from '@/lib/gamification';
import { generateQuestions } from '@/lib/gemini';

const DAILY_TOPICS = [
  { name: "React Essentials", slug: "react-essentials" },
  { name: "Next.js App Router", slug: "nextjs-app-router" },
  { name: "TypeScript Power User", slug: "typescript-power-user" },
  { name: "Modern CSS Mastery", slug: "modern-css-mastery" },
  { name: "Node.js Architecture", slug: "nodejs-architecture" },
  { name: "Web Security Basics", slug: "web-security-basics" },
  { name: "System Design 101", slug: "system-design-101" }
];

export async function GET(req: Request) {
  await dbConnect();
  try {
    const session = await getServerSession(authOptions) as any;
    const userId = session?.user?.id;

    const now = new Date();
    // End of day calculation
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    
    let activeChallenge = await (DailyChallenge as any).findOne({
      expiresAt: { $gt: now },
    }).sort({ expiresAt: 1 }).lean() as any;

    if (!activeChallenge) {
      // Auto-Seed for today if missing
      console.log("No active challenge found. Auto-seeding...");
      const randomTopic = DAILY_TOPICS[Math.floor(Math.random() * DAILY_TOPICS.length)];
      try {
        const questions = await generateQuestions({
          numQuestions: 5,
          difficulty: "medium",
          tags: randomTopic.slug,
          title: `Daily: ${randomTopic.name}`,
          description: `A daily challenge to test your ${randomTopic.name} skills.`
        });

        if (questions && questions.length > 0) {
          activeChallenge = await (DailyChallenge as any).create({
            topicName: randomTopic.name,
            topicSlug: randomTopic.slug,
            difficulty: "medium",
            questions: questions.map(q => ({
              questionText: q.text || q.questionText,
              options: q.options,
              correctAnswer: q.correctAnswer,
              explanation: q.explanation || `This covers a core concept in ${randomTopic.name}.`
            })),
            expiresAt: endOfDay,
            bonusXP: 50
          });
          activeChallenge = activeChallenge.toObject();
        }
      } catch (seedErr) {
        console.error("Auto-seeding failed:", seedErr);
      }
    }

    if (!activeChallenge) {
      return NextResponse.json({ active: false, message: 'No active challenge today.' });
    }

    const hasCompleted = userId ? activeChallenge.completedBy.includes(userId) : false;
    
    // Timer should always count down primarily to the end of the current day
    // to give the "daily" feel, even if the challenge record is set for longer.
    const timeRemainingMs = endOfDay.getTime() - now.getTime();

    // Return without questions array
    const { questions, ...challengeMeta } = activeChallenge;
    // Ensure the displayed daily bonus matches the unified XP formula.
    (challengeMeta as any).bonusXP = calculateXP({
      score: 0,
      isDailyChallenge: true,
    }).bonusXP;

    return NextResponse.json({
      active: true,
      challenge: challengeMeta,
      hasCompleted,
      timeRemainingMs,
    });
  } catch (error) {
    console.error('Daily Challenge GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
