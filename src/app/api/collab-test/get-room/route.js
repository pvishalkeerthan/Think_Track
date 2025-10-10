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

  const { roomId } = await req.json();

  try {
    const room = await Room.findById(roomId);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Debug logging
    console.log("🔥 Retrieved room:", room.roomCode);
    console.log("🔥 Room questions count:", room.questions?.length);
    console.log("🔥 First question:", room.questions?.[0]);

    const isHost = room.hostId.toString() === session.user._id;

    // Only host can activate the test
    if (isHost && room.status === "waiting") {
      room.status = "active";
      room.startedAt = new Date();
      await room.save();
    }

    return NextResponse.json({ room, isHost, success: true });
  } catch (error) {
    console.error("Get Room Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
