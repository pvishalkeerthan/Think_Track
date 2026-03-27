import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import dbConnect from "@/lib/dbConnect";
import CommunityQuestion from "@/models/CommunityQuestion";
import User from "@/models/user.model";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as any;
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const { questionId, type } = await req.json(); // type: "approve" or "reject"

    if (!["approve", "reject"].includes(type)) {
      return NextResponse.json({ error: "Invalid vote type" }, { status: 400 });
    }

    // 1. Check if user is reputable (Level > 5) or special admin
    const user = await (User as any).findOne({ email: session.user.email });
    const isSpecialUser = session.user.email === "v@gmail.com";
    
    if (!user || (user.level < 5 && !isSpecialUser)) {
      return NextResponse.json({ 
        error: "Insufficient Reputation", 
        message: "You need to be Level 5 or higher to review community questions." 
      }, { status: 403 });
    }

    const question = await (CommunityQuestion as any).findById(questionId);
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // 2. Prevent duplicate voting
    const userId = user._id.toString();
    if (question.approvals.includes(userId) || question.rejections.includes(userId)) {
      return NextResponse.json({ error: "Already voted" }, { status: 400 });
    }

    // 3. Register vote
    if (type === "approve") {
      question.approvals.push(userId);
      // Auto-approve if 1 vote reached (simplified for now)
      if (question.approvals.length >= 1) {
        question.approved = true;
      }
    } else {
      question.rejections.push(userId);
    }

    await question.save();

    return NextResponse.json({ 
      success: true, 
      approved: question.approved,
      approvals: question.approvals.length,
      rejections: question.rejections.length
    });

  } catch (error) {
    console.error("Error in vote API:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
