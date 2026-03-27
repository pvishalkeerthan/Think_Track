import dbConnect from "@/lib/dbConnect";
import User from "@/models/user.model";
import {
  processTestCompletion,
  applyMasteryDecay,
  checkStreakRisk,
} from "@/lib/gamificationTracker";

type CalculateXPInput = {
  score: number; // quiz score: 0-100
  isDailyChallenge?: boolean;
  streakMilestone7?: boolean; // reached 7-day streak (one-time)
  streakMilestone30?: boolean; // reached 30-day streak (one-time)
};

export function calculateXP({
  score,
  isDailyChallenge = false,
  streakMilestone7 = false,
  streakMilestone30 = false,
}: CalculateXPInput) {
  const baseXP = Math.round(score * 1.0); // clean 0-100 range
  const dailyBonusXP = isDailyChallenge ? 50 : 0;
  const streakBonusXP =
    (streakMilestone7 ? 25 : 0) + (streakMilestone30 ? 25 : 0);

  return {
    baseXP,
    dailyBonusXP,
    streakBonusXP,
    totalXP: baseXP + dailyBonusXP + streakBonusXP,
    // UI-friendly split: "XP Earned" excludes the daily challenge bonus.
    xpEarned: baseXP + streakBonusXP,
    bonusXP: dailyBonusXP,
  };
}

function getLevelFromXP(totalXP: number) {
  // Simple exponential thresholds: 0,100,250,450,700,1000,...
  const thresholds = [0];
  let next = 100;
  while (thresholds.length < 50) {
    thresholds.push(next);
    next = Math.floor(next * 1.5);
  }

  let level = 1;
  for (let i = 1; i < thresholds.length; i++) {
    if (totalXP >= thresholds[i]) level = i + 1;
    else break;
  }
  return Math.min(level, 50);
}

export async function awardXP(
  userId: string,
  xp: ReturnType<typeof calculateXP>
) {
  await dbConnect();
  const user = await (User as any).findById(userId);
  if (!user) return null;

  const badges = new Set((user.badges || []).map((b: any) => b.code));

  user.totalXP = Math.max(0, (user.totalXP || 0) + xp.totalXP);
  user.level = getLevelFromXP(user.totalXP || 0);

  const maybeAddBadge = (
    code: string,
    title: string,
    description: string,
    rarity: string = "common"
  ) => {
    if (!badges.has(code)) {
      user.badges.push({
        code,
        title,
        description,
        rarity,
        earnedAt: new Date(),
      });
      badges.add(code);
    }
  };

  if (user.totalXP >= 1000)
    maybeAddBadge(
      "XP_1000",
      "1000 XP Earned",
      "Reached 1000 total XP",
      "rare"
    );
  if (user.streak >= 7)
    maybeAddBadge("STREAK_7", "Week Warrior", "7-day streak", "rare");
  if (user.streak >= 30)
    maybeAddBadge(
      "STREAK_30",
      "Month Master",
      "30-day streak",
      "epic"
    );

  await user.save();

  return { ...xp, totalXP: user.totalXP, level: user.level, streak: user.streak };
}

// Re-export gamification state updates so app code can consistently import from
// `src/lib/gamification`.
export { processTestCompletion, applyMasteryDecay, checkStreakRisk };

