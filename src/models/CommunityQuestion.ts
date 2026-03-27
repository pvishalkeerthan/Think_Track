import mongoose from "mongoose";

const communityQuestionSchema = new mongoose.Schema(
  {
    submitterId: { type: String, required: true },
    topic: { type: String, required: true },
    questionText: { type: String, required: true },
    questionType: { type: String, enum: ["MCQ", "True/False", "Fill in the Blank"], required: true },
    options: { type: [String], default: [] }, // Applicable for MCQ
    correctAnswer: { type: String, required: true },
    approved: { type: Boolean, default: false },
    approvals: { type: [String], default: [] }, // Array of user IDs who approved
    rejections: { type: [String], default: [] }, // Array of user IDs who rejected
    timesUsed: { type: Number, default: 0 },
    learnersHelped: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.CommunityQuestion || mongoose.model("CommunityQuestion", communityQuestionSchema);
