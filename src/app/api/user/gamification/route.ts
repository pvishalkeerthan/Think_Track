export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user.model';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { applyMasteryDecay, checkStreakRisk } from '@/lib/gamification';

export async function GET(req: Request) {
  await dbConnect();
  const session = await getServerSession(authOptions) as any;
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  await applyMasteryDecay(userId);
  await checkStreakRisk(userId);

  const user = await (User as any).findById(userId).lean() as any;
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  let masteryArray: any[] = [];
  if (user.topicMasteryMap) {
    const tpm: any = user.topicMasteryMap;
    if (tpm && typeof tpm.entries === "function") {
      masteryArray = Array.from(tpm.entries()).map(([slug, data]: any) => ({
        slug,
        ...data,
      })).sort((a: any, b: any) => b.score - a.score);
    } else {
      masteryArray = Object.entries(tpm).map(([slug, data]: any) => ({
        slug,
        ...data,
      })).sort((a: any, b: any) => b.score - a.score);
    }
  }

  return NextResponse.json({
    streak: user.streak,
    longestStreakEver: user.longestStreakEver,
    streakAtRisk: user.streakAtRisk,
    topicMasteryMap: masteryArray,
    pinnedBadges: user.pinnedBadges || [],
    questionsContributed: user.questionsContributed || 0,
    learnersHelped: user.learnersHelped || 0,
  });
}
