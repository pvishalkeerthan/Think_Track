export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user.model';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

export async function POST(req: Request) {
  await dbConnect();
  const session = await getServerSession(authOptions) as any;
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { badgeId } = await req.json();
  if (!badgeId) return NextResponse.json({ error: 'badgeId required' }, { status: 400 });

  const user = await (User as any).findById(session.user.id);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  if (!user.pinnedBadges) user.pinnedBadges = [];

  const index = user.pinnedBadges.indexOf(badgeId);
  if (index > -1) {
    user.pinnedBadges.splice(index, 1);
  } else {
    if (user.pinnedBadges.length >= 3) {
      return NextResponse.json({ error: 'Maximum of 3 badges can be pinned.' }, { status: 400 });
    }
    user.pinnedBadges.push(badgeId);
  }

  await user.save();
  return NextResponse.json({ success: true, pinnedBadges: user.pinnedBadges });
}
