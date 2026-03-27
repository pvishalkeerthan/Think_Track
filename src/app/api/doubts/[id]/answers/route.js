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

  const { content } = await req.json();
  if (!content)
    return NextResponse.json(
      { success: false, error: "content is required" },
      { status: 400 }
    );

  const doubt = await Doubt.findById(params.id);
  if (!doubt)
    return NextResponse.json(
      { success: false, error: "Not found" },
      { status: 404 }
    );

  doubt.answers.push({ author: session.user.id, content });
  await doubt.save();

  return NextResponse.json({ success: true, data: doubt });
}
