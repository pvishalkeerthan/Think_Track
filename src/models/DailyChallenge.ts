import mongoose from "mongoose";

const dailyChallengeSchema = new mongoose.Schema(
  {
    topicName: { type: String, required: true },
    topicSlug: { type: String, required: true },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
    questions: { type: Array, required: true }, // Stores full questions array matching Test shape
    // When this challenge expires, it should no longer be considered "active".
    // Naming is important because the API queries `{ expiresAt: { $gt: new Date() } }`.
    expiresAt: { type: Date, required: true },
    // Back-compat for older seeded challenges.
    expiryDate: { type: Date },
    completedBy: { type: [String], default: [] }, // Array of user IDs
    bonusXP: { type: Number, default: 50 },
    globalAverageScore: { type: Number, default: 0 },
    completionCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.DailyChallenge || mongoose.model("DailyChallenge", dailyChallengeSchema);
