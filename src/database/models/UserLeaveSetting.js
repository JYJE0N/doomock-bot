// src/database/models/UserLeaveSetting.js - 개인 연차 설정 모델
const mongoose = require("mongoose");

/**
 * 👤 UserLeaveSetting - 개인 연차 설정 모델
 *
 * 🎯 핵심 필드:
 * - userId: 사용자 ID
 * - totalLeave: 총 연차 일수 (기본 15일 + 보너스)
 * - joinDate: 입사일 (근속 보너스 계산용)
 * - customLeave: 수동 추가/삭제된 연차
 * - year: 해당 연도
 */
const userLeaveSettingSchema = new mongoose.Schema(
  {
    // 👤 사용자 ID
    userId: {
      type: String,
      required: [true, "사용자 ID는 필수입니다"],
      trim: true,
    },

    // 📅 해당 연도
    year: {
      type: Number,
      required: [true, "연도는 필수입니다"],
      default: () => new Date().getFullYear(),
    },

    // 📊 총 연차 일수
    totalLeave: {
      type: Number,
      required: [true, "총 연차 일수는 필수입니다"],
      min: [0, "연차는 0일 이상이어야 합니다"],
      max: [50, "연차는 50일 이하여야 합니다"],
      default: 15,
    },

    // 💼 입사일
    joinDate: {
      type: Date,
      default: null,
    },

    // 🎁 수동 조정 연차 (관리자나 사용자가 추가/삭제)
    customLeave: {
      type: Number,
      default: 0,
      min: [-20, "최대 20일까지 차감 가능합니다"],
      max: [20, "최대 20일까지 추가 가능합니다"],
    },

    // 📝 설정 변경 이력
    changeHistory: [
      {
        date: { type: Date, default: Date.now },
        action: { type: String, enum: ["add", "remove", "reset", "join_date"] },
        amount: { type: Number, default: 0 },
        reason: { type: String, default: "" },
        oldValue: { type: Number },
        newValue: { type: Number },
      },
    ],

    // 🔄 활성 상태
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "user_leave_settings",
  }
);

// ===== 🎯 인덱스 설정 =====
userLeaveSettingSchema.index({ userId: 1, year: 1 }, { unique: true }); // 사용자당 연도별 고유
userLeaveSettingSchema.index({ userId: 1 }); // 사용자별 조회

// ===== 🎯 가상 속성 =====
userLeaveSettingSchema.virtual("workYears").get(function () {
  if (!this.joinDate) return 0;

  const now = new Date();
  const join = new Date(this.joinDate);
  const diffTime = Math.abs(now - join);
  const years = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365));

  return years;
});

userLeaveSettingSchema.virtual("yearlyBonus").get(function () {
  const workYears = this.workYears;
  return workYears >= 2 ? Math.floor(workYears / 2) : 0;
});

userLeaveSettingSchema.virtual("finalTotalLeave").get(function () {
  return 15 + this.yearlyBonus + this.customLeave;
});

// ===== 🎯 정적 메서드 =====

/**
 * 📊 사용자 연차 설정 조회 또는 생성
 */
userLeaveSettingSchema.statics.getOrCreate = async function (
  userId,
  year = null
) {
  const targetYear = year || new Date().getFullYear();

  let setting = await this.findOne({
    userId: String(userId),
    year: targetYear,
    isActive: true,
  });

  if (!setting) {
    setting = new this({
      userId: String(userId),
      year: targetYear,
      totalLeave: 15,
    });
    await setting.save();
  }

  return setting;
};

/**
 * ➕ 연차 추가
 */
userLeaveSettingSchema.statics.addLeave = async function (
  userId,
  amount,
  reason = "수동 추가"
) {
  const currentYear = new Date().getFullYear();
  const setting = await this.getOrCreate(userId, currentYear);

  const oldValue = setting.customLeave;
  setting.customLeave += amount;

  // 변경 이력 추가
  setting.changeHistory.push({
    action: "add",
    amount: amount,
    reason: reason,
    oldValue: oldValue,
    newValue: setting.customLeave,
  });

  return await setting.save();
};

/**
 * ➖ 연차 삭제
 */
userLeaveSettingSchema.statics.removeLeave = async function (
  userId,
  amount,
  reason = "수동 삭제"
) {
  const currentYear = new Date().getFullYear();
  const setting = await this.getOrCreate(userId, currentYear);

  const oldValue = setting.customLeave;
  setting.customLeave -= amount;

  // 최소값 체크
  if (setting.customLeave < -20) {
    setting.customLeave = -20;
  }

  // 변경 이력 추가
  setting.changeHistory.push({
    action: "remove",
    amount: amount,
    reason: reason,
    oldValue: oldValue,
    newValue: setting.customLeave,
  });

  return await setting.save();
};

/**
 * 💼 입사일 설정
 */
userLeaveSettingSchema.statics.setJoinDate = async function (userId, joinDate) {
  const currentYear = new Date().getFullYear();
  const setting = await this.getOrCreate(userId, currentYear);

  const oldDate = setting.joinDate;
  setting.joinDate = new Date(joinDate);

  // 변경 이력 추가
  setting.changeHistory.push({
    action: "join_date",
    reason: `입사일 변경: ${
      oldDate ? oldDate.toISOString().split("T")[0] : "없음"
    } → ${joinDate}`,
    oldValue: oldDate ? oldDate.getTime() : null,
    newValue: setting.joinDate.getTime(),
  });

  return await setting.save();
};

/**
 * 🔄 연차 초기화 (신년)
 */
userLeaveSettingSchema.statics.resetForNewYear = async function (
  userId,
  newYear
) {
  // 기존 설정에서 입사일만 가져오기
  const lastYearSetting = await this.findOne({
    userId: String(userId),
    year: newYear - 1,
    isActive: true,
  });

  const newSetting = new this({
    userId: String(userId),
    year: newYear,
    totalLeave: 15,
    joinDate: lastYearSetting ? lastYearSetting.joinDate : null,
    customLeave: 0, // 신년에는 수동 조정 초기화
    changeHistory: [
      {
        action: "reset",
        reason: `${newYear}년 신규 연차 생성`,
        oldValue: 0,
        newValue: 15,
      },
    ],
  });

  return await newSetting.save();
};

// ===== 🎯 인스턴스 메서드 =====

/**
 * 📊 현재 총 연차 계산
 */
userLeaveSettingSchema.methods.calculateTotalLeave = function () {
  const baseLeave = 15;
  const bonus = this.yearlyBonus;
  const custom = this.customLeave;

  return baseLeave + bonus + custom;
};

/**
 * 📋 변경 이력 요약
 */
userLeaveSettingSchema.methods.getChangesSummary = function () {
  return this.changeHistory.map((change) => ({
    date: change.date.toISOString().split("T")[0],
    action: change.action,
    amount: change.amount,
    reason: change.reason,
  }));
};

// ===== 🎯 JSON 변환 설정 =====
userLeaveSettingSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

const UserLeaveSetting = mongoose.model(
  "UserLeaveSetting",
  userLeaveSettingSchema
);
module.exports = UserLeaveSetting;
