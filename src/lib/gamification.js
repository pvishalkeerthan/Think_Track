import dbConnect from "@/lib/dbConnect";
import User from "@/models/user.model";

function getLevelFromXP(totalXP) {
  // Simple exponential thresholds: 0,100,250,450,700,1000,1400,...
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

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export async function awardXP(userId, amount, options = {}) {
  await dbConnect();
  const user = await User.findById(userId);
  if (!user) return null;

  user.totalXP = Math.max(0, (user.totalXP || 0) + amount);

  // Streak handling on any activity
  const now = new Date();
  const last = user.lastActiveDate ? new Date(user.lastActiveDate) : null;
  if (!last) {
    user.streak = 1;
  } else if (!isSameDay(last, now)) {
    const diffDays = Math.floor(
      (now - new Date(last.setHours(0, 0, 0, 0))) / (24 * 60 * 60 * 1000)
    );
    if (diffDays === 1) user.streak = (user.streak || 0) + 1;
    else if (diffDays > 1) user.streak = 1; // reset
  }
  user.lastActiveDate = now;

  // Level recalculation
  user.level = getLevelFromXP(user.totalXP || 0);

  // Basic badge unlocking examples
  const badges = new Set((user.badges || []).map((b) => b.code));
  const maybeAddBadge = (code, title, description, rarity = "common") => {
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
    maybeAddBadge("XP_1000", "1000 XP Earned", "Reached 1000 total XP", "rare");
  if ((user.streak || 0) >= 7)
    maybeAddBadge("STREAK_7", "Week Warrior", "7-day streak", "rare");
  if ((user.streak || 0) >= 30)
    maybeAddBadge("STREAK_30", "Month Master", "30-day streak", "epic");

  await user.save();
  return { totalXP: user.totalXP, level: user.level, streak: user.streak };
}
