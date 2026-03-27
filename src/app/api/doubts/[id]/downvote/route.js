export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Doubt from "@/models/Doubt";
import User from "@/models/user.model";
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

  const { answerId } = await req.json();
  if (!answerId)
    return NextResponse.json(
      { success: false, error: "answerId is required" },
      { status: 400 }
    );

  const doubt = await Doubt.findById(params.id);
  if (!doubt)
    return NextResponse.json(
      { success: false, error: "Not found" },
      { status: 404 }
    );

  const answer = doubt.answers.id(answerId);
  if (!answer)
    return NextResponse.json(
      { success: false, error: "Answer not found" },
      { status: 404 }
    );

  // If previously upvoted, remove that upvote to avoid double-counting
  const userId = session.user.id;
  const idx = answer.upvoters.findIndex((id) => String(id) === String(userId));
  if (idx !== -1) {
    answer.upvoters.splice(idx, 1);
    answer.upvotes = Math.max(0, (answer.upvotes || 0) - 1);
    doubt.totalUpvotes = Math.max(0, (doubt.totalUpvotes || 0) - 1);
  }

  await doubt.save();

  // Optionally reduce XP of author slightly (conservative approach omitted)
  return NextResponse.json({
    success: true,
    data: { upvotes: answer.upvotes },
  });
}
