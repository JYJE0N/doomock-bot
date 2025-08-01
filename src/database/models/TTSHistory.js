// src/database/models/TTSHistory.js
const mongoose = require("mongoose");

const TTSHistorySchema = new mongoose.Schema(
  {
    // userId: {
    //   type: String,
    //   required: true,
    // index: true,
    // },
    text: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    languageCode: {
      type: String,
      required: true,
    },
    voiceName: {
      type: String,
      required: true,
    },
    durationSeconds: {
      type: Number,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt 자동 생성
    collection: "tts_history", // 컬렉션 이름 지정
  }
);

// 사용자별 최신순 조회를 위한 복합 인덱스
TTSHistorySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("TTSHistory", TTSHistorySchema);
