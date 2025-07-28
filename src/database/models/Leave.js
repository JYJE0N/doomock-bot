// src/database/models/Leave.js - 더미 모델
const mongoose = require("mongoose");

const leaveSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    year: { type: Number, required: true },
    days: { type: Number, required: true },
    reason: String,
    usedDate: Date,
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("Leave", leaveSchema);
