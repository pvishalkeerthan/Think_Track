const mongoose = require("mongoose");

const ParticipantSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  score: {
    type: Number,
    default: 0,
  },
  answers: [
    {
      questionIndex: Number,
      userAnswer: String,
      isCorrect: Boolean,
      timeSpent: Number,
    },
  ],
  isFinished: {
    type: Boolean,
    default: false,
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
});

const RoomSchema = new mongoose.Schema(
  {
    hostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    roomCode: {
      type: String,
      required: true,
      unique: true,
    },
    testMeta: {
      title: String,
      description: String,
      numQuestions: Number,
      difficulty: {
        type: String,
        enum: ["easy", "medium", "hard"],
      },
      timeLimit: Number,
    },
    questions: [
      {
        text: String,
        options: [String],
        correctAnswer: String,
      },
    ],
    participants: [ParticipantSchema],
    status: {
      type: String,
      enum: ["waiting", "active", "completed"],
      default: "waiting",
    },
    startedAt: Date,
    endedAt: Date,
  },
  { timestamps: true }
);

const Room = mongoose.models.Room || mongoose.model("Room", RoomSchema);

module.exports = Room;
