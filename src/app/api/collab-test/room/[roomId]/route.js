export const dynamic = 'force-dynamic';
import dbConnect from '@/lib/dbConnect';
import Room from '@/models/Room';
import User from '@/models/user.model';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

export async function GET(req, { params }) {
  await dbConnect();

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await User.findOne({ email: session.user.email });

  try {
    const room = await Room.findById(params.roomId).lean();
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const isHost = room.hostId.toString() === user._id.toString();

    return NextResponse.json({ room, isHost });
  } catch (error) {
    console.error('Room Fetch Error:', error);
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
