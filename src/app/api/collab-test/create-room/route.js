import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import dbConnect from "@/lib/dbConnect";
import Room from "@/models/Room";
import Test from "@/models/Test";
import User from "@/models/user.model";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import mongoose from "mongoose";

export async function POST(req) {
  await dbConnect();

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { testId } = await req.json();

    if (!mongoose.Types.ObjectId.isValid(testId)) {
      return NextResponse.json({ error: "Invalid Test ID" }, { status: 400 });
    }

    const test = await Test.findById(testId);
    if (!test) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }

    // Debug logging
    console.log("🔥 Test found:", {
      title: test.title,
      questionsCount: test.questions.length,
      firstQuestion: test.questions[0],
    });

    const dbUser = await User.findOne({ email: session.user.email });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const roomCode = uuidv4().slice(0, 6).toUpperCase();

    const newRoom = new Room({
      hostId: dbUser._id,
      roomCode,
      testMeta: {
        title: test.title,
        description: test.description,
        numQuestions: test.numQuestions,
        difficulty: test.difficulty,
        timeLimit: test.timeLimit,
      },
      questions: test.questions.map((q) => ({
        text: q.text,
        options: q.options,
        correctAnswer: q.correctAnswer,
      })),

      participants: [
        {
          userId: dbUser._id,
          name: dbUser.name,
          score: 0,
          answers: [],
          isFinished: false,
        },
      ],
    });

    await newRoom.save();

    // Debug logging
    console.log("🔥 Room created with questions:", newRoom.questions.length);
    console.log("🔥 First question:", newRoom.questions[0]);
    console.log(
      "🔥 All questions:",
      newRoom.questions.map((q) => ({
        text: q.text,
        optionsCount: q.options.length,
        hasCorrectAnswer: !!q.correctAnswer,
      }))
    );

    return NextResponse.json({ success: true, roomCode, roomId: newRoom._id });
  } catch (error) {
    console.error("🔥 Create Room Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
