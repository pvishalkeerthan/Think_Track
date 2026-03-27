import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      match: [/.+\@.+\..+/, "Please enter a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    role: {
      type: String,
      enum: ["student", "working professional"],
      required: [true, "Role is required"],
      default: "student",
    },
    // Gamification fields
    totalXP: {
      type: Number,
      default: 0,
      min: 0,
    },
    level: {
      type: Number,
      default: 1,
      min: 1,
    },
    streak: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastActiveDate: {
      type: Date,
    },
    longestStreakEver: {
      type: Number,
      default: 0,
    },
    streakAtRisk: {
      type: Boolean,
      default: false,
    },
    topicMasteryMap: {
      type: Map,
      of: new mongoose.Schema(
        {
          score: { type: Number, default: 0, min: 0, max: 100 },
          lastTested: { type: Date, default: Date.now },
          decayApplied: { type: Boolean, default: false },
        },
        { _id: false }
      ),
      default: {},
    },
    pinnedBadges: {
      type: [String],
      default: [],
    },
    savedDecks: {
      type: [
        new mongoose.Schema({
          name: { type: String, required: true },
          topic: { type: String, required: true },
          difficulty: { type: String, required: true },
          questionTypes: { type: [String], default: [] },
          timeLimit: { type: Number },
          questionCount: { type: Number, required: true },
          createdAt: { type: Date, default: Date.now },
        }),
      ],
      default: [],
    },
    questionsContributed: {
      type: Number,
      default: 0,
    },
    learnersHelped: {
      type: Number,
      default: 0,
    },
    badges: {
      type: [
        new mongoose.Schema(
          {
            code: { type: String, required: true }, // unique identifier like 'FIRST_TEST'
            title: { type: String, required: true },
            description: { type: String },
            rarity: {
              type: String,
              enum: ["common", "rare", "epic", "legendary"],
              default: "common",
            },
            earnedAt: { type: Date, default: Date.now },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    featuredBadges: {
      type: [String], // array of badge codes to feature
      default: [],
    },
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
