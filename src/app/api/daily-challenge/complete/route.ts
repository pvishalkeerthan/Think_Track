export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import DailyChallenge from '@/models/DailyChallenge';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { processTestCompletion, awardXP, calculateXP } from '@/lib/gamification';
import TestResult from '@/models/TestResult';
import User from '@/models/user.model';

export async function POST(req: Request) {
  await dbConnect();
  try {
    const session = await getServerSession(authOptions) as any;
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { challengeId, userAnswers } = await req.json();
    
    const challenge = await (DailyChallenge as any).findById(challengeId);
    const expiresAt = (challenge as any)?.expiresAt ?? (challenge as any)?.expiryDate;
    if (!challenge || !expiresAt || expiresAt < new Date()) {
      return NextResponse.json({ error: 'Challenge expired or not found' }, { status: 400 });
    }

    if (challenge.completedBy.includes(userId)) {
      return NextResponse.json({ error: 'Already completed' }, { status: 403 });
    }

    let correctCount = 0;
    const questionsForDB = challenge.questions.map((q: any) => {
      const qId = q._id || q.questionText;
      const uAnswer = userAnswers[qId] || "No answer";
      const isCorrect = uAnswer === q.correctAnswer;
      if (isCorrect) correctCount++;
      return {
        questionText: q.questionText,
        options: q.options || [],
        correctAnswer: q.correctAnswer,
        userAnswer: uAnswer,
        isCorrect: isCorrect,
        explanation: q.explanation || "No explanation provided"
      };
    });

    const score = Math.round((correctCount / challenge.questions.length) * 100);

    const testResult = await (TestResult as any).create({
      userId,
      testId: challenge._id, // we cheat by assigning daily challenge id
      dailyChallengeId: challenge._id,
      topicSlug: challenge.topicSlug,
      difficulty: challenge.difficulty,
      // daily bonus is applied via unified XP awarding below
      score,
      correctAnswers: correctCount,
      wrongAnswers: challenge.questions.length - correctCount,
      analysis: "Daily challenge completed.",
      questions: questionsForDB,
      // Change: Sanitize keys to replace '.' with a Unicode character to avoid MongoDB/Mongoose restrictions.
      userAnswers: Object.fromEntries(
        Object.entries(userAnswers || {}).map(([key, value]) => [
          key.replace(/\./g, "\uFF0E"), // Use full-width dot
          value,
        ])
      ),
    });

    const totalScorePoints = challenge.globalAverageScore * challenge.completionCount;
    challenge.completionCount += 1;
    challenge.globalAverageScore = (totalScorePoints + score) / challenge.completionCount;
    challenge.completedBy.push(userId);
    await challenge.save();

    console.log("[processTestCompletion] inputs:", {
      userId,
      topicSlug: challenge?.topicSlug,
      score,
    });
    await processTestCompletion(userId, score, challenge.topicSlug);

    // Post-call verification: ensure streak + topic mastery updated.
    const verificationUser = await (User as any).findById(userId).lean();
    const topicMasteryAny = (verificationUser?.topicMasteryMap as any) || {};
    const hasTopicMastery = Boolean(
      (topicMasteryAny.get && topicMasteryAny.get(challenge.topicSlug)) ||
        topicMasteryAny[challenge.topicSlug]
    );
    if (!verificationUser?.streak || !hasTopicMastery) {
      throw new Error(
        "processTestCompletion verification failed: streak or topicMasteryMap not updated"
      );
    }

    // Award XP (base + daily + any one-time streak milestone bonuses).
    const updatedUser = verificationUser;
    const badgeCodes = new Set(
      (updatedUser?.badges || []).map((b: any) => b.code)
    );
    const streakMilestone7 =
      (updatedUser?.streak || 0) >= 7 && !badgeCodes.has("STREAK_7");
    const streakMilestone30 =
      (updatedUser?.streak || 0) >= 30 && !badgeCodes.has("STREAK_30");

    const xp = calculateXP({
      score,
      isDailyChallenge: true,
      streakMilestone7,
      streakMilestone30,
    });

    const awarded = await awardXP(userId, xp);
    if (awarded) {
      testResult.xpEarned = awarded.xpEarned;
      testResult.bonusXP = awarded.bonusXP;
      await testResult.save();
    }

    return NextResponse.json({ 
      bonusXP: xp?.bonusXP || 0,
      globalAverageScore: challenge.globalAverageScore,
      completionCount: challenge.completionCount,
      resultId: testResult._id
    });
  } catch (error) {
    console.error('Daily Challenge Complete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
