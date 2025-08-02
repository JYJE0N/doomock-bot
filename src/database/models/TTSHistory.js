// src/database/models/TTSHistory.js
const mongoose = require("mongoose");

const TTSHistorySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  text: {
    type: String,
    required: true,
    maxlength: 500,
  },
  language: {
    type: String,
    required: true,
    enum: ["ko-KR", "en-US"],
  },
  voice: String,
  voiceCode: String,
  fileName: String,
  shareUrl: String,
  createdAt: {
    type: Date,
    default: Date.now,
    // index: true,
  },
});

// 인덱스
TTSHistorySchema.index({ userId: 1, createdAt: -1 });
TTSHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 }); // 24시간 후 자동 삭제

module.exports = mongoose.model("TTSHistory", TTSHistorySchema);
