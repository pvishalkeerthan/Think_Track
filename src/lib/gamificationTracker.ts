import User from "../models/user.model";
import TestResult from "../models/TestResult";

/**
 * Call after every single test completion.
 * Handles streak update, topic mastery update, clearing atRisk flag.
 */
export async function processTestCompletion(
  userId: string,
  testScore: number,
  topicSlug?: string
) {
  const user = await (User as any).findById(userId);
  if (!user) return;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  let lastActiveStart = new Date(0);
  if (user.lastActiveDate) {
    lastActiveStart = new Date(
      user.lastActiveDate.getFullYear(),
      user.lastActiveDate.getMonth(),
      user.lastActiveDate.getDate()
    );
  }

  const daysDifference = Math.floor((todayStart.getTime() - lastActiveStart.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDifference === 1) {
    // Completed yesterday, streak continues!
    user.streak += 1;
  } else if (daysDifference > 1) {
    // Skipped a day, reset streak
    user.streak = 1;
  } else if (!user.lastActiveDate) {
    // First time
    user.streak = 1;
  }
  // If daysDifference === 0, they already completed something today. Streak unchanged.

  if (user.streak > (user.longestStreakEver || 0)) {
    user.longestStreakEver = user.streak;
  }

  user.lastActiveDate = now;
  user.streakAtRisk = false;

  // Topic mastery map using weighted average (70% old, 30% new)
  if (topicSlug) {
    let masteryMapAny = user.topicMasteryMap as any;
    const hasMapMethods =
      masteryMapAny &&
      typeof masteryMapAny.get === "function" &&
      typeof masteryMapAny.set === "function";

    // Mongoose can sometimes hydrate Maps as plain objects; handle both.
    if (!masteryMapAny) {
      user.topicMasteryMap = {};
      masteryMapAny = user.topicMasteryMap as any;
    }

    const currentMastery = hasMapMethods
      ? masteryMapAny.get(topicSlug)
      : masteryMapAny?.[topicSlug];

    const nextMastery = currentMastery
      ? {
          score: Math.min(100, currentMastery.score * 0.7 + testScore * 0.3),
          lastTested: now,
          decayApplied: false,
        }
      : {
          score: testScore,
          lastTested: now,
          decayApplied: false,
        };

    if (hasMapMethods) {
      masteryMapAny.set(topicSlug, nextMastery);
    } else {
      (masteryMapAny as any)[topicSlug] = nextMastery;
    }
  }

  try {
    await user.save();
  } catch (e) {
    console.error("processTestCompletion user.save failed:", e);
    throw e;
  }
}

/**
 * Reduce by 15% if older than 30 days
 */
export async function applyMasteryDecay(userId: string) {
  const user = await (User as any).findById(userId);
  if (!user || !user.topicMasteryMap) return;

  const now = new Date();
  let changed = false;

  const masteryMapAny = user.topicMasteryMap as any;
  const hasMapMethods =
    masteryMapAny &&
    typeof masteryMapAny.get === "function" &&
    typeof masteryMapAny.set === "function";

  const entries = (hasMapMethods
    ? Array.from(masteryMapAny.entries())
    : Object.entries(masteryMapAny || {})) as any;

  for (const [slug, mastery] of entries) {
    const daysSinceTested = Math.floor(
      (now.getTime() - new Date(mastery.lastTested).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceTested > 30 && !mastery.decayApplied) {
      const currentScore = mastery.score;
      const nextValue = {
        ...mastery,
        score: Math.max(0, currentScore * 0.85),
        decayApplied: true,
      };
      if (hasMapMethods) {
        masteryMapAny.set(slug, nextValue);
      } else {
        masteryMapAny[slug] = nextValue;
      }
      changed = true;
    }
  }

  if (changed) {
    await user.save();
  }
}

/**
 * Mark in DB if >= 18 hrs since last activity
 */
export async function checkStreakRisk(userId: string) {
  const user = await (User as any).findById(userId);
  if (!user || !user.lastActiveDate || user.streak === 0) return false;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastActiveStart = new Date(
    user.lastActiveDate.getFullYear(),
    user.lastActiveDate.getMonth(),
    user.lastActiveDate.getDate()
  );

  const daysDifference = Math.floor((todayStart.getTime() - lastActiveStart.getTime()) / (1000 * 60 * 60 * 24));

  // Check if >= 18 hours have passed since last activity
  if (daysDifference >= 1) { // They missed today so far
    const hoursSinceLastActivity = (now.getTime() - user.lastActiveDate.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastActivity >= 18) {
      if (!user.streakAtRisk) {
        user.streakAtRisk = true;
        await user.save();
      }
      return true;
    }
  }

  if (user.streakAtRisk) {
    user.streakAtRisk = false;
    await user.save();
  }
  return false;
}
