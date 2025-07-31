// src/database/models/Leave.js - 🏖️ 간단한 연차 관리 모델
const mongoose = require("mongoose");

/**
 * 🏖️ Leave - 연차 사용 기록 모델
 *
 * 🎯 간단한 연차 관리 요구사항:
 * - 연차/반차/반반차 사용 기록
 * - 사용 날짜와 잔여 연차 추적
 * - 연간 리셋 (1월 1일 ~ 12월 31일)
 * - 이월 불가, 간단한 승인 시스템
 */

const leaveSchema = new mongoose.Schema(
  {
    // 👤 사용자 ID - ✅ 중복 인덱스 방지 (index: true 제거)
    userId: {
      type: String,
      required: [true, "사용자 ID는 필수입니다"],
      // ❌ index: true 제거! (하단에서 복합 인덱스로 처리)
    },

    // 📅 연도
    year: {
      type: Number,
      required: [true, "연도는 필수입니다"],
      min: [2020, "2020년 이후만 입력 가능합니다"],
      max: [2030, "2030년 이전만 입력 가능합니다"],
      default: function () {
        return new Date().getFullYear();
      },
    },

    // 📊 사용 일수 (0.25, 0.5, 1.0)
    days: {
      type: Number,
      required: [true, "사용 일수는 필수입니다"],
      validate: {
        validator: function (value) {
          // 0.25일 단위만 허용
          return [
            0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0,
          ].includes(value);
        },
        message: "0.25일 단위로만 사용 가능합니다",
      },
    },

    // 🏷️ 연차 타입
    leaveType: {
      type: String,
      enum: {
        values: ["반반차", "반차", "연차"],
        message: "유효하지 않은 연차 타입입니다",
      },
      required: [true, "연차 타입은 필수입니다"],
    },

    // 📅 사용 날짜
    usedDate: {
      type: Date,
      required: [true, "사용 날짜는 필수입니다"],
      default: Date.now,
    },

    // 📝 사유 (선택사항)
    reason: {
      type: String,
      trim: true,
      maxlength: [200, "사유는 200자를 초과할 수 없습니다"],
      default: "",
    },

    // ✅ 상태 (간단한 시스템이므로 자동 승인)
    status: {
      type: String,
      enum: {
        values: ["approved", "cancelled"],
        message: "유효하지 않은 상태입니다",
      },
      default: "approved",
    },

    // 🎯 메타데이터 (최소한)
    metadata: {
      requestedBy: {
        type: String,
        default: "사용자",
      },
      requestedAt: {
        type: Date,
        default: Date.now,
      },
      source: {
        type: String,
        default: "bot",
      },
    },

    // 🔄 활성 상태 (소프트 삭제용)
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt 자동 생성
    versionKey: false,
    collection: "leaves",
  }
);

// ===== 🎯 인덱스 정의 (중복 제거!) =====

// 🔍 주요 조회 패턴용 복합 인덱스들
leaveSchema.index({ userId: 1, year: -1 }); // 사용자별 연도순 조회
leaveSchema.index({ userId: 1, usedDate: -1 }); // 사용자별 날짜순 조회
leaveSchema.index({ userId: 1, status: 1 }); // 사용자별 상태 조회
leaveSchema.index({ userId: 1, year: 1, isActive: 1 }); // 연차 현황 조회용

// 📊 통계용 인덱스
leaveSchema.index({ year: 1, status: 1 }); // 연도별 집계
leaveSchema.index({ usedDate: -1 }); // 전체 사용 날짜순

// ===== 🎯 가상 속성 (Virtual) =====

// 사용 월
leaveSchema.virtual("usedMonth").get(function () {
  return this.usedDate ? this.usedDate.getMonth() + 1 : null;
});

// 사용 주차
leaveSchema.virtual("usedWeek").get(function () {
  if (!this.usedDate) return null;

  const date = new Date(this.usedDate);
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / (1000 * 60 * 60 * 24);
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
});

// 포맷된 날짜들
leaveSchema.virtual("formattedUsedDate").get(function () {
  if (!this.usedDate) return null;
  return this.usedDate.toISOString().split("T")[0]; // YYYY-MM-DD
});

leaveSchema.virtual("formattedCreatedAt").get(function () {
  if (!this.createdAt) return null;
  return this.createdAt.toLocaleString("ko-KR");
});

// ===== 🎯 인스턴스 메서드 =====

// 연차 취소
leaveSchema.methods.cancel = function () {
  this.status = "cancelled";
  return this.save();
};

// 날짜 변경
leaveSchema.methods.changeDate = function (newDate) {
  this.usedDate = newDate;
  return this.save();
};

// ===== 🎯 정적 메서드 (Static Methods) =====

// 사용자의 연간 연차 통계
leaveSchema.statics.getYearlyStats = async function (userId, year) {
  const currentYear = year || new Date().getFullYear();

  const stats = await this.aggregate([
    {
      $match: {
        userId: userId.toString(),
        year: currentYear,
        isActive: true,
        status: "approved",
      },
    },
    {
      $group: {
        _id: "$leaveType",
        totalDays: { $sum: "$days" },
        count: { $sum: 1 },
      },
    },
  ]);

  // 결과를 표준 구조로 변환
  const result = {
    year: currentYear,
    quarter: { days: 0, count: 0 }, // 반반차
    half: { days: 0, count: 0 }, // 반차
    full: { days: 0, count: 0 }, // 연차
    total: { days: 0, count: 0 },
  };

  stats.forEach((stat) => {
    const total = stat.totalDays;
    const count = stat.count;

    if (stat._id === "반반차") {
      result.quarter = { days: total, count };
    } else if (stat._id === "반차") {
      result.half = { days: total, count };
    } else if (stat._id === "연차") {
      result.full = { days: total, count };
    }

    result.total.days += total;
    result.total.count += count;
  });

  return result;
};

// 월별 연차 사용 현황
leaveSchema.statics.getMonthlyUsage = async function (userId, year) {
  const currentYear = year || new Date().getFullYear();

  const monthlyStats = await this.aggregate([
    {
      $match: {
        userId: userId.toString(),
        year: currentYear,
        isActive: true,
        status: "approved",
      },
    },
    {
      $group: {
        _id: { $month: "$usedDate" },
        totalDays: { $sum: "$days" },
        count: { $sum: 1 },
        records: {
          $push: {
            days: "$days",
            leaveType: "$leaveType",
            usedDate: "$usedDate",
            reason: "$reason",
          },
        },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  // 12개월 배열로 변환
  const result = [];
  for (let month = 1; month <= 12; month++) {
    const monthData = monthlyStats.find((stat) => stat._id === month);

    result.push({
      month: month,
      monthName: `${month}월`,
      totalDays: monthData?.totalDays || 0,
      count: monthData?.count || 0,
      records: monthData?.records || [],
    });
  }

  return result;
};

// 잔여 연차 계산 (UserLeaveSetting과 연동)
leaveSchema.statics.getRemainingLeave = async function (
  userId,
  year,
  annualLimit = 15
) {
  const stats = await this.getYearlyStats(userId, year);
  return Math.max(0, annualLimit - stats.total.days);
};

// 오늘 사용한 연차 조회
leaveSchema.statics.getTodayUsage = async function (userId) {
  const today = new Date();
  const startOfDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const todayLeaves = await this.find({
    userId: userId.toString(),
    usedDate: { $gte: startOfDay, $lt: endOfDay },
    isActive: true,
    status: "approved",
  }).lean();

  const totalUsed = todayLeaves.reduce((sum, leave) => sum + leave.days, 0);

  return {
    hasUsage: todayLeaves.length > 0,
    totalDays: totalUsed,
    records: todayLeaves,
  };
};

// ===== 🎯 미들웨어 =====

// 저장 전 처리
leaveSchema.pre("save", function (next) {
  // 연차 타입 자동 설정 (days 값 기준)
  if (this.isModified("days") || this.isNew) {
    if (this.days === 0.25) {
      this.leaveType = "반반차";
    } else if (this.days === 0.5) {
      this.leaveType = "반차";
    } else if (this.days >= 1.0) {
      this.leaveType = "연차";
    }
  }

  // 연도 자동 설정 (usedDate 기준)
  if (this.isModified("usedDate") || this.isNew) {
    this.year = this.usedDate.getFullYear();
  }

  next();
});

// 저장 후 로깅
leaveSchema.post("save", function (doc) {
  console.log(
    `🏖️ 연차 사용 기록 저장: ${doc.userId} - ${doc.days}일 (${doc.leaveType})`
  );
});

// ===== 🎯 JSON 변환 설정 =====

leaveSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;

    // 메타데이터 간소화
    if (ret.metadata) {
      ret.source = ret.metadata.source;
      ret.requestedBy = ret.metadata.requestedBy;
      delete ret.metadata;
    }

    return ret;
  },
});

// ===== 🎯 모델 생성 및 내보내기 =====

const Leave = mongoose.model("Leave", leaveSchema);

module.exports = Leave;
