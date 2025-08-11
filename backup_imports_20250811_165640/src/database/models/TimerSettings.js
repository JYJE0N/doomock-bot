// src/database/models/TimerSettings.js
const mongoose = require("mongoose");

// TimerSettings 스키마 생성
const timerSettingsSchema = new mongoose.Schema(
  {
    // 사용자 식별자
    // userId: { type: String, required: true, unique: true },

    // 시간 설정 (분 단위)
    focusDuration: { type: Number, default: 25, min: 1, max: 120 },
    shortBreakDuration: { type: Number, default: 5, min: 1, max: 30 },
    longBreakDuration: { type: Number, default: 15, min: 5, max: 60 },
    sessionsBeforeLongBreak: { type: Number, default: 4, min: 2, max: 10 },

    // 기능 설정
    enableNotifications: { type: Boolean, default: true },
    enableStats: { type: Boolean, default: true },
    autoStartBreak: { type: Boolean, default: false },
    autoStartFocus: { type: Boolean, default: false },

    // 목표 설정
    dailyGoal: { type: Number, default: 8, min: 1, max: 50 },
    weeklyGoal: { type: Number, default: 40, min: 1, max: 200 },

    // 사용자 선호
    preferredTags: [String],
    defaultNote: { type: String, maxlength: 200 },

    // 알림 설정
    notificationSound: {
      type: String,
      enum: ["default", "bell", "chime", "silent"],
      default: "default"
    },
    notificationVolume: { type: Number, default: 0.7, min: 0, max: 1 },

    // 활성 상태
    isActive: { type: Boolean, default: true }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// ===== 인덱스 =====
timerSettingsSchema.index({ userId: 1 }, { unique: true });

// ===== 인스턴스 메서드 =====

/**
 * 설정 업데이트
 */
timerSettingsSchema.methods.updateSettings = async function (updates) {
  Object.assign(this, updates);
  return await this.save();
};

/**
 * 기본값으로 재설정
 */
timerSettingsSchema.methods.resetToDefaults = async function () {
  this.focusDuration = 25;
  this.shortBreakDuration = 5;
  this.longBreakDuration = 15;
  this.sessionsBeforeLongBreak = 4;
  this.enableNotifications = true;
  this.enableStats = true;
  this.autoStartBreak = false;
  this.autoStartFocus = false;
  this.dailyGoal = 8;
  this.weeklyGoal = 40;
  return await this.save();
};

// ===== 정적 메서드 =====

/**
 * 사용자 설정 가져오기 (없으면 생성)
 */
timerSettingsSchema.statics.getOrCreate = async function (userId) {
  let settings = await this.findOne({ userId: String(userId) });

  if (!settings) {
    settings = new this({ userId: String(userId) });
    await settings.save();
  }

  return settings;
};

module.exports = mongoose.model("TimerSettings", timerSettingsSchema);
