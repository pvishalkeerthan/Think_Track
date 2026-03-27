export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Doubt from "@/models/Doubt";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/authOptions';

export async function POST(req, { params }) {
  await dbConnect();
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { answerId } = body || {};

  const doubt = await Doubt.findById(params.id);
  if (!doubt)
    return NextResponse.json(
      { success: false, error: "Not found" },
      { status: 404 }
    );

  // If no `answerId` is provided, treat this as an upvote on the doubt/question itself.
  if (!answerId) {
    doubt.totalUpvotes += 1;
    await doubt.save();

    return NextResponse.json({
      success: true,
      data: { upvotes: doubt.totalUpvotes },
    });
  }

  const answer = doubt.answers.id(answerId);
  if (!answer)
    return NextResponse.json(
      { success: false, error: "Answer not found" },
      { status: 404 }
    );

  const userId = session.user.id;
  const already = answer.upvoters.some((id) => String(id) === String(userId));
  if (already) {
    return NextResponse.json(
      { success: false, error: "Already upvoted" },
      { status: 400 }
    );
  }

  answer.upvotes += 1;
  answer.upvoters.push(userId);
  doubt.totalUpvotes += 1;
  await doubt.save();

  return NextResponse.json({
    success: true,
    data: { upvotes: answer.upvotes },
  });
}
