export const dynamic = 'force-dynamic';
import dbConnect from '@/lib/dbConnect';
import Test from '@/models/Test';
import { NextResponse } from 'next/server';

export async function GET() {
  await dbConnect();
  try {
    const tests = await Test.find({}, '_id title').lean();
    return NextResponse.json({ tests });
  } catch (err) {
    console.error('Fetch tests error:', err);
    return NextResponse.json({ error: 'Failed to fetch tests' }, { status: 500 });
  }
}
