import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Doubt from "@/models/Doubt";
import User from "@/models/user.model";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

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

  // Award XP to answer author for receiving upvote
  if (answer.author) {
    await User.findByIdAndUpdate(answer.author, { $inc: { totalXP: 5 } });
  }

  return NextResponse.json({
    success: true,
    data: { upvotes: answer.upvotes },
  });
}
