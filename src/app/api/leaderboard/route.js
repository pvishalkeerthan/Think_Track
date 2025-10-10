import dbConnect from "@/lib/dbConnect";
import User from "@/models/user.model";
import { NextResponse } from "next/server";

export async function GET(req) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view") || "global"; // global|streak

  let sort = { totalXP: -1 };
  if (view === "streak") sort = { streak: -1, totalXP: -1 };

  const users = await User.find({}, "name email totalXP level streak badges")
    .sort(sort)
    .limit(100)
    .lean();

  return NextResponse.json({ success: true, data: users });
}
