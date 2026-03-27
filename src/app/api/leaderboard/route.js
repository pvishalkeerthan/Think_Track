export const dynamic = 'force-dynamic';
import dbConnect from "@/lib/dbConnect";
import User from "@/models/user.model";
import TestResult from "@/models/TestResult";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

export async function GET(req) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view") || "global"; // global|streak
  const userId = searchParams.get("userId");

  // Note: existing leaderboard data includes historical XP values computed before the
  // unified XP formula introduced in `src/lib/gamification.ts`, so older results may not
  // be directly comparable to newly awarded XP.

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.max(1, parseInt(searchParams.get("limit") || "20", 10));
  const skip = (page - 1) * limit;

  // Only include users who have at least one test completion.
  const activeUserIds = await TestResult.distinct("userId");
  const activeUserObjectIds = activeUserIds
    .map((id) => {
      try {
        return mongoose.Types.ObjectId.isValid(id)
          ? new mongoose.Types.ObjectId(id)
          : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const filter = { 
    _id: { $in: activeUserObjectIds },
    totalXP: { $gt: 0 }
  };

  let sort = { totalXP: -1 };
  if (view === "streak") sort = { streak: -1, totalXP: -1 };

  const totalCount = await User.countDocuments(filter);
  const users = await User.find(filter, "name email totalXP streak")
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();

  let myRank = null;
  if (userId && activeUserIds.length > 0) {
    const me = await User.findById(userId, "totalXP streak").lean();
    if (me) {
      if (view === "streak") {
        myRank =
          (await User.countDocuments({
            ...filter,
            $or: [
              { streak: { $gt: me.streak || 0 } },
              {
                streak: me.streak || 0,
                totalXP: { $gt: me.totalXP || 0 },
              },
            ],
          })) + 1;
      } else {
        // global
        myRank =
          (await User.countDocuments({
            ...filter,
            $or: [
              { totalXP: { $gt: me.totalXP || 0 } },
              {
                totalXP: me.totalXP || 0,
                streak: { $gt: me.streak || 0 },
              },
            ],
          })) + 1;
      }
    }
  }

  return NextResponse.json({
    success: true,
    data: users,
    pagination: { page, limit, totalCount },
    myRank,
  });
}
