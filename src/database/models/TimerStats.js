// src/database/models/TimerStats.js
const mongoose = require("mongoose");

// TimerStats 스키마 생성
const timerStatsSchema = new mongoose.Schema(
  {
    // 식별자
    userId: { type: String, required: true, index: true },
    date: { type: String, required: true }, // YYYY-MM-DD 형식

    // 세션별 카운트
    focusStarted: { type: Number, default: 0 },
    focusCompleted: { type: Number, default: 0 },
    focusStopped: { type: Number, default: 0 },

    shortBreakStarted: { type: Number, default: 0 },
    shortBreakCompleted: { type: Number, default: 0 },
    shortBreakStopped: { type: Number, default: 0 },

    longBreakStarted: { type: Number, default: 0 },
    longBreakCompleted: { type: Number, default: 0 },
    longBreakStopped: { type: Number, default: 0 },

    // 전체 통계
    totalStarted: { type: Number, default: 0 },
    totalCompleted: { type: Number, default: 0 },
    totalStopped: { type: Number, default: 0 },
    totalMinutes: { type: Number, default: 0 },

    // 추가 메트릭
    longestFocusStreak: { type: Number, default: 0 },
    averageFocusDuration: { type: Number, default: 0 },

    // 활성 상태
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ===== 인덱스 =====
// 유니크 복합 인덱스
timerStatsSchema.index({ userId: 1, date: -1 }, { unique: true });
timerStatsSchema.index({ date: -1 });

// ===== 정적 메서드 =====

/**
 * 일일 통계 업데이트 또는 생성
 */
timerStatsSchema.statics.updateDaily = async function (userId, date, updates) {
  return this.findOneAndUpdate(
    { userId: String(userId), date },
    { $inc: updates },
    { upsert: true, new: true }
  );
};

/**
 * 기간별 통계 조회
 */
timerStatsSchema.statics.getStatsByDateRange = function (
  userId,
  startDate,
  endDate
) {
  return this.find({
    userId: String(userId),
    date: { $gte: startDate, $lte: endDate },
    isActive: true,
  }).sort({ date: -1 });
};

/**
 * 월별 집계
 */
timerStatsSchema.statics.getMonthlyAggregate = async function (
  userId,
  year,
  month
) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-31`;

  return this.aggregate([
    {
      $match: {
        userId: String(userId),
        date: { $gte: startDate, $lte: endDate },
        isActive: true,
      },
    },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: "$totalCompleted" },
        totalMinutes: { $sum: "$totalMinutes" },
        totalDays: { $sum: 1 },
        avgSessionsPerDay: { $avg: "$totalCompleted" },
        avgMinutesPerDay: { $avg: "$totalMinutes" },
      },
    },
  ]);
};

module.exports = mongoose.model("TimerStats", timerStatsSchema);
