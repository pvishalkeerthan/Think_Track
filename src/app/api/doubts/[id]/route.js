import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Doubt from "@/models/Doubt";

export async function GET(_req, { params }) {
  await dbConnect();
  const doubt = await Doubt.findById(params.id)
    .populate("asker", "name email")
    .populate("answers.author", "name email")
    .lean();
  if (!doubt)
    return NextResponse.json(
      { success: false, error: "Not found" },
      { status: 404 }
    );
  return NextResponse.json({ success: true, data: doubt });
}
