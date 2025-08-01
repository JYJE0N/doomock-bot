// database/models/Worktime.js 수정

const mongoose = require("mongoose");
const TimeHelper = require("../../utils/TimeHelper");

const WorktimeSchema = new mongoose.Schema({
  // ✅ userId 필드 추가
  userId: {
    type: String,
    required: true,
    // index: true 제거 (복합인덱스에서 처리)
  },

  date: {
    type: String, // YYYY-MM-DD 형식
    required: true,
    index: true,
  },

  checkInTime: {
    type: Date,
    default: null,
  },

  checkOutTime: {
    type: Date,
    default: null,
  },

  workDuration: {
    type: Number, // 분 단위
    default: 0,
  },

  regularHours: {
    type: Number, // 정규 근무 시간
    default: 0,
  },

  overtimeHours: {
    type: Number, // 초과 근무 시간
    default: 0,
  },

  workType: {
    type: String,
    enum: ["normal", "overtime", "holiday"],
    default: "normal",
  },

  status: {
    type: String,
    enum: ["working", "completed", "cancelled"],
    default: "working",
  },

  // ✅ 표준 필드들 수정
  createdAt: {
    type: Date,
    default: Date.now, // ✅ Date.now 사용
  },

  updatedAt: {
    type: Date,
    default: Date.now, // ✅ Date.now 사용
  },

  version: {
    type: Number,
    default: 1,
  },

  isActive: {
    type: Boolean,
    default: true,
  },
});

// ✅ 복합 인덱스 (userId 포함)
WorktimeSchema.index({ userId: 1, date: 1 }, { unique: true });
WorktimeSchema.index({ userId: 1, createdAt: -1 });
WorktimeSchema.index({ date: 1, isActive: 1 });

module.exports = mongoose.model("Worktime", WorktimeSchema);
