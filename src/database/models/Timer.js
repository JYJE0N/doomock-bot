// src/database/models/Timer.js - 더미 모델
const mongoose = require("mongoose");

const timerSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    type: { type: String, default: "pomodoro" },
    duration: { type: Number, default: 25 },
    status: { type: String, default: "idle" },
    startTime: Date,
    endTime: Date,
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("Timer", timerSchema);
