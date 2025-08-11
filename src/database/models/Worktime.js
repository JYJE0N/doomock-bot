// database/models/Worktime.js 수정

const mongoose = require("mongoose");
const TimeHelper = require('../../utils/formatting/TimeHelper');

const WorktimeSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },

  date: {
    type: String, // YYYY-MM-DD 형식
    required: true,
    index: true
  },

  checkInTime: {
    type: Date,
    default: null
  },

  checkOutTime: {
    type: Date,
    default: null
  },

  workDuration: {
    type: Number, // 분 단위
    default: 0
  },

  regularHours: {
    type: Number, // 정규 근무 시간
    default: 0
  },

  overtimeHours: {
    type: Number, // 초과 근무 시간
    default: 0
  },

  workType: {
    type: String,
    enum: ["normal", "overtime", "holiday", "night"], // ✅ "night" 추가!
    default: "normal"
  },

  status: {
    type: String,
    enum: ["working", "completed", "cancelled"],
    default: "working"
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  },

  version: {
    type: Number,
    default: 1
  },

  isActive: {
    type: Boolean,
    default: true
  }
});

// 복합 인덱스
WorktimeSchema.index({ userId: 1, date: 1 }, { unique: true });
WorktimeSchema.index({ userId: 1, createdAt: -1 });
WorktimeSchema.index({ date: 1, isActive: 1 });

module.exports = mongoose.model("Worktime", WorktimeSchema);
