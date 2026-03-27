export const dynamic = 'force-dynamic';
import dbConnect from "@/lib/dbConnect";
import Room from "@/models/Room";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/authOptions';
import { NextResponse } from "next/server";

export async function POST(req) {
  await dbConnect();

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await req.json();
  if (!roomId) {
    return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
  }

  try {
    const room = await Room.findById(roomId);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const participant = room.participants.find(
      (p) => p.userId.toString() === session.user._id
    );

    if (!participant) {
      return NextResponse.json(
        { error: "Participant not found" },
        { status: 403 }
      );
    }

    if (participant.isFinished) {
      return NextResponse.json({ success: true, message: "Already finished" });
    }

    const correctCount = participant.answers.filter((a) => a.isCorrect).length;
    const totalTime = participant.answers.reduce(
      (sum, a) => sum + (a.timeSpent || 0),
      0
    );

    participant.score = correctCount;
    participant.totalTime = totalTime;
    participant.isFinished = true;

    await room.save();

    return NextResponse.json({ success: true, score: correctCount, totalTime });
  } catch (error) {
    console.error("Complete Test Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
