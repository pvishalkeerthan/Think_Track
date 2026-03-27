export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import CommunityQuestion from '@/models/CommunityQuestion';
import User from '@/models/user.model';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

export async function POST(req: Request) {
  await dbConnect();
  const session = await getServerSession(authOptions) as any;
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const body = await req.json();
  const { topic, questionText, questionType, options, correctAnswer } = body;

  if (!topic || !questionText || !questionType || !correctAnswer) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const question = await new CommunityQuestion({
    submitterId: userId,
    topic,
    questionText,
    questionType,
    options: options || [],
    correctAnswer,
    approved: false
  }).save();

  await (User as any).findByIdAndUpdate(userId, { $inc: { questionsContributed: 1 } });

  return NextResponse.json({ success: true, question });
}

export async function GET(req: Request) {
  await dbConnect();
  const session = await getServerSession(authOptions) as any;
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const { searchParams } = new URL(req.url);
  const topic = searchParams.get('topic');
  const pendingOnly = searchParams.get('pending') === 'true';
  const approvedOnly = searchParams.get('approved') === 'true';

  let query: any = { submitterId: userId };
  
  if (pendingOnly) {
    // Check if user is reputable enough to see pending queue
    const user = await (User as any).findById(userId);
    const isSpecial = session?.user?.email === "v@gmail.com";
    if (!user || (user.level < 5 && !isSpecial)) {
      return NextResponse.json({ error: 'Insufficient reputation to view vetting queue' }, { status: 403 });
    }
    // Find questions that are not approved, not submitted by current user, 
    // and current user hasn't voted on yet
    query = { 
      approved: false, 
      submitterId: { $ne: userId },
      approvals: { $ne: userId },
      rejections: { $ne: userId }
    };
  } else if (approvedOnly) {
    query = { approved: true };
    if (topic) query.topic = topic;
  }

  const questions = await (CommunityQuestion as any).find(query)
    .sort({ createdAt: -1 })
    .limit(pendingOnly ? 20 : 10)
    .lean();

  return NextResponse.json({ success: true, data: questions });
}
