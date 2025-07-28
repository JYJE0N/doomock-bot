// src/database/models/Reminder.js - 더미 모델
const mongoose = require("mongoose");

const reminderSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    message: { type: String, required: true },
    reminderTime: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    isCompleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("Reminder", reminderSchema);
