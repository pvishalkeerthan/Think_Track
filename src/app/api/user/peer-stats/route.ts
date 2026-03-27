export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import TestResult from '@/models/TestResult';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import mongoose from 'mongoose';

export async function GET(req: Request) {
  await dbConnect();
  const session = await getServerSession(authOptions) as any;
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const userObjId = new mongoose.Types.ObjectId(userId);

  const userResults = await TestResult.aggregate([
    { $match: { userId: userObjId, createdAt: { $gte: sevenDaysAgo }, topicSlug: { $exists: true, $ne: null } } },
    { $group: { _id: "$topicSlug", count: { $sum: 1 }, avgScore: { $avg: "$score" } } },
    { $sort: { count: -1 } },
    { $limit: 1 }
  ]);

  if (userResults.length === 0) {
    return NextResponse.json({ available: false });
  }

  const mostTestedTopic = userResults[0]._id;
  const userAvgScore = Math.round(userResults[0].avgScore);

  const peerResults = await TestResult.aggregate([
    { $match: { userId: { $ne: userObjId }, createdAt: { $gte: sevenDaysAgo }, topicSlug: mostTestedTopic } },
    { $group: { _id: null, uniqueUsers: { $addToSet: "$userId" }, avgScore: { $avg: "$score" } } }
  ]);

  if (peerResults.length === 0 || peerResults[0].uniqueUsers.length === 0) {
    return NextResponse.json({ available: false });
  }

  return NextResponse.json({
    available: true,
    topicName: mostTestedTopic.replace(/-/g, ' ').replace(/\b\w/g, (l:string) => l.toUpperCase()),
    learnerCount: peerResults[0].uniqueUsers.length,
    peerAverage: Math.round(peerResults[0].avgScore),
    userAverage: userAvgScore
  });
}
