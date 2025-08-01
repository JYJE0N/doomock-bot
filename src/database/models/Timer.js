// src/database/models/Timer.js
const mongoose = require("mongoose");

// Timer 스키마 생성
const timerSchema = new mongoose.Schema(
  {
    // 사용자 정보
    // userId: { type: String, required: true },
    // userName: { type: String, required: true },

    // 세션 정보
    type: {
      type: String,
      enum: ["focus", "shortBreak", "longBreak"],
      default: "focus",
      required: true,
    },
    duration: { type: Number, required: true, default: 25 }, // 분 단위

    // 상태 관리
    status: {
      type: String,
      enum: ["active", "paused", "completed", "stopped"],
      default: "active",
      required: true,
    },

    // 시간 추적
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date, default: null },
    pausedAt: { type: Date, default: null },
    resumedAt: { type: Date, default: null },
    pausedDuration: { type: Number, default: 0 }, // 밀리초
    completedDuration: { type: Number, default: 0 }, // 초

    // 추가 정보
    cycleNumber: { type: Number, default: 1 },
    tags: [String],
    note: { type: String, maxlength: 500 },
    wasCompleted: { type: Boolean, default: false },

    // 진행 상황
    lastProgress: {
      remainingTime: Number,
      updatedAt: Date,
    },

    // 활성 상태
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ===== 인덱스 =====
timerSchema.index({ userId: 1, startedAt: -1 });
timerSchema.index({ status: 1, startedAt: -1 });

// ===== 인스턴스 메서드 =====

/**
 * 세션 완료 처리
 */
timerSchema.methods.complete = async function () {
  this.status = "completed";
  this.completedAt = new Date();
  this.wasCompleted = true;
  return await this.save();
};

/**
 * 세션 일시정지
 */
timerSchema.methods.pause = async function () {
  this.status = "paused";
  this.pausedAt = new Date();
  return await this.save();
};

/**
 * 세션 재개
 */
timerSchema.methods.resume = async function () {
  if (this.status !== "paused") {
    throw new Error("일시정지된 세션만 재개할 수 있습니다.");
  }

  const pausedTime = Date.now() - this.pausedAt.getTime();
  this.pausedDuration += pausedTime;
  this.status = "active";
  this.resumedAt = new Date();
  return await this.save();
};

/**
 * 소프트 삭제
 */
timerSchema.methods.softDelete = function () {
  this.isActive = false;
  return this.save();
};

// ===== 정적 메서드 =====

/**
 * 활성 세션 조회
 */
timerSchema.statics.findActiveSessions = function () {
  return this.find({
    status: { $in: ["active", "paused"] },
    isActive: true,
  });
};

/**
 * 사용자의 오늘 완료한 세션 수
 */
timerSchema.statics.countTodayCompleted = async function (userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return this.countDocuments({
    userId: String(userId),
    status: "completed",
    completedAt: { $gte: today },
    isActive: true,
  });
};

/**
 * 사용자의 세션 조회
 */
timerSchema.statics.findByUser = function (userId, options = {}) {
  const query = this.find({
    userId: String(userId),
    isActive: true,
  });

  if (options.status) {
    query.where("status", options.status);
  }

  if (options.type) {
    query.where("type", options.type);
  }

  if (options.startDate && options.endDate) {
    query.where("startedAt").gte(options.startDate).lte(options.endDate);
  }

  return query
    .sort(options.sort || { startedAt: -1 })
    .limit(options.limit || 0);
};

module.exports = mongoose.model("Timer", timerSchema);
