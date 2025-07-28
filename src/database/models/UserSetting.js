// src/database/models/UserSetting.js - 더미 모델
const mongoose = require("mongoose");

const userSettingSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    notifications: { type: Boolean, default: true },
    timezone: { type: String, default: "Asia/Seoul" },
    language: { type: String, default: "ko" },
    workStartTime: { type: String, default: "09:00" },
    workEndTime: { type: String, default: "18:00" },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("UserSetting", userSettingSchema);
