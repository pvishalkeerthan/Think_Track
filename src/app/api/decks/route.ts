export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user.model';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

export async function GET(req: Request) {
  await dbConnect();
  const session = await getServerSession(authOptions) as any;
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await (User as any).findById(session.user.id);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  return NextResponse.json({ decks: user.savedDecks || [] });
}

export async function POST(req: Request) {
  await dbConnect();
  const session = await getServerSession(authOptions) as any;
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, topic, difficulty, questionTypes, questionCount, timeLimit } = body;

  if (!name || !topic || !difficulty || !questionCount) {
    return NextResponse.json({ error: 'Missing required configuration fields' }, { status: 400 });
  }

  const user = await (User as any).findById(session.user.id);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  if (!user.savedDecks) user.savedDecks = [];
  const newDeck = { name, topic, difficulty, questionTypes, questionCount, timeLimit };
  user.savedDecks.push(newDeck);
  await user.save();

  return NextResponse.json({ success: true, deck: user.savedDecks[user.savedDecks.length - 1] });
}

export async function DELETE(req: Request) {
  await dbConnect();
  const session = await getServerSession(authOptions) as any;
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const deckId = searchParams.get('id');
  if (!deckId) return NextResponse.json({ error: 'Deck ID required' }, { status: 400 });

  const user = await (User as any).findById(session.user.id);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  if (user.savedDecks) {
    user.savedDecks = user.savedDecks.filter((d: any) => d._id.toString() !== deckId);
    await user.save();
  }

  return NextResponse.json({ success: true });
}
