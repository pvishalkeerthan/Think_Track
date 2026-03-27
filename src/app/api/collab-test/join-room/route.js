export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Room from '@/models/Room';
import User from '@/models/user.model';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

export async function POST(req) {
  await dbConnect();

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { roomCode } = await req.json();

  try {
    const room = await Room.findOne({ roomCode });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Check if already joined
    const alreadyJoined = room.participants.some(
      (p) => p.userId.toString() === session.user._id
    );
    const dbUser = await User.findOne({ email: session.user.email });

    if (!alreadyJoined) {
      room.participants.push({
        userId: dbUser._id,
       name: dbUser.name,
      });
      await room.save();
    }

    return NextResponse.json({ success: true, roomId: room._id });
  } catch (error) {
    console.error('Join Room Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
