export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import DailyChallenge from '@/models/DailyChallenge';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { calculateXP } from '@/lib/gamification';

export async function GET(req: Request) {
  await dbConnect();
  try {
    const session = await getServerSession(authOptions) as any;
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    let activeChallenge = await (DailyChallenge as any).findOne({
      expiresAt: { $gt: now },
    }).lean() as any;

    // Back-compat: migrate legacy `expiryDate` -> `expiresAt` if needed.
    if (!activeChallenge) {
      const legacyChallenge = await (DailyChallenge as any).findOne({
        expiryDate: { $gt: now },
      }).lean() as any;
      if (legacyChallenge?.expiryDate) {
        await (DailyChallenge as any).updateOne(
          { _id: legacyChallenge._id },
          { $set: { expiresAt: legacyChallenge.expiryDate } }
        );
        activeChallenge = await (DailyChallenge as any).findOne({
          expiresAt: { $gt: now },
        }).lean() as any;
      }
    }

    if (!activeChallenge) {
      return NextResponse.json({ error: 'No active challenge today.' }, { status: 404 });
    }

    // Ensure the displayed daily bonus matches the unified XP formula.
    (activeChallenge as any).bonusXP = calculateXP({
      score: 0,
      isDailyChallenge: true,
    }).bonusXP;

    if (activeChallenge.completedBy.includes(userId)) {
      return NextResponse.json(
        { error: 'You have already completed today\'s challenge.', challenge: activeChallenge },
        { status: 403 }
      );
    }

    return NextResponse.json({ challenge: activeChallenge });
  } catch (error) {
    console.error('Daily Challenge Start error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
