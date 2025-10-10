import mongoose from "mongoose";

const AnswerSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: { type: String, required: true },
    upvotes: { type: Number, default: 0 },
    upvoters: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    isAI: { type: Boolean, default: false },
  },
  { timestamps: true, _id: true }
);

const DoubtSchema = new mongoose.Schema(
  {
    asker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    questionText: { type: String, required: true },
    userAnswer: { type: String },
    correctAnswer: { type: String },
    confusion: { type: String },
    tags: { type: [String], default: [] },
    aiAnswer: { type: String },
    aiAnswerPending: { type: Boolean, default: false },
    answers: { type: [AnswerSchema], default: [] },
    totalUpvotes: { type: Number, default: 0 },
    relatedTestResultId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TestResult",
    },
    relatedQuestionIndex: { type: Number },
    status: { type: String, enum: ["open", "resolved"], default: "open" },
  },
  { timestamps: true }
);

DoubtSchema.index({ createdAt: -1 });
DoubtSchema.index({ tags: 1 });
DoubtSchema.index({ totalUpvotes: -1 });

export default mongoose.models.Doubt || mongoose.model("Doubt", DoubtSchema);
