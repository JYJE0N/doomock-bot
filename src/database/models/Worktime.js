// src/database/models/Worktime.js - 더미 모델
const mongoose = require("mongoose");

const worktimeSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    date: { type: String, required: true },
    checkInTime: Date,
    checkOutTime: Date,
    workDuration: Number,
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("Worktime", worktimeSchema);
