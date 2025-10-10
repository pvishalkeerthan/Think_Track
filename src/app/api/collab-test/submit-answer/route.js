import dbConnect from "@/lib/dbConnect";
import Room from "@/models/Room";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextResponse } from "next/server";

export async function POST(req) {
  await dbConnect();

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId, questionIndex, userAnswer, isCorrect, timeSpent } =
    await req.json();

  if (
    typeof questionIndex !== "number" ||
    !roomId ||
    !userAnswer ||
    typeof isCorrect !== "boolean" ||
    typeof timeSpent !== "number"
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
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
        { error: "User not part of this room" },
        { status: 403 }
      );
    }

    // Prevent duplicate submissions
    const alreadyAnswered = participant.answers.some(
      (ans) => ans.questionIndex === questionIndex
    );
    if (alreadyAnswered) {
      return NextResponse.json({ error: "Already answered" }, { status: 409 });
    }

    // Add answer
    participant.answers.push({
      questionIndex,
      userAnswer,
      isCorrect,
      timeSpent,
    });

    // ✅ Increment score if correct
    if (isCorrect) {
      participant.score += 1;
    }

    await room.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Submit Answer Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
