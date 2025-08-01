// src/database/models/Leave.js - 🏖️ 연차 관리 모델 (정적 메서드 추가)
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
    // 👤 사용자 ID
    // userId: {
    //   type: String,
    //   required: [true, "사용자 ID는 필수입니다"],
    // },

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

    // 🎯 메타데이터
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

    // 🔄 활성 상태
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "leaves",
  }
);

// ===== 🎯 인덱스 정의 =====
leaveSchema.index({ userId: 1, year: -1 });
leaveSchema.index({ userId: 1, usedDate: -1 });
leaveSchema.index({ userId: 1, status: 1 });
leaveSchema.index({ userId: 1, year: 1, isActive: 1 });
leaveSchema.index({ year: 1, status: 1 });
leaveSchema.index({ usedDate: -1 });

// ===== 🎯 가상 속성 =====
leaveSchema.virtual("usedMonth").get(function () {
  return this.usedDate ? this.usedDate.getMonth() + 1 : null;
});

leaveSchema.virtual("formattedUsedDate").get(function () {
  return this.usedDate ? this.usedDate.toISOString().split("T")[0] : null;
});

// ===== 🚀 핵심 정적 메서드 추가 =====

/**
 * 🏖️ 연차 현황 조회 (핵심 메서드!)
 */
leaveSchema.statics.getLeaveStatus = async function (userId, year = null) {
  const targetYear = year || new Date().getFullYear();

  try {
    // 사용된 연차 총합 계산
    const usedLeaves = await this.aggregate([
      {
        $match: {
          userId: userId.toString(),
          year: targetYear,
          isActive: true,
          status: "approved",
        },
      },
      {
        $group: {
          _id: null,
          totalUsed: { $sum: "$days" },
          totalRecords: { $sum: 1 },
        },
      },
    ]);

    const totalUsed = usedLeaves.length > 0 ? usedLeaves[0].totalUsed : 0;

    // 기본 연차일수 (환경변수 또는 기본값)
    const annualLeave = parseInt(process.env.DEFAULT_ANNUAL_LEAVE) || 15;
    const remaining = Math.max(0, annualLeave - totalUsed);

    return {
      userId: userId.toString(),
      year: targetYear,
      annual: annualLeave,
      used: totalUsed,
      remaining: remaining,
      usageRate: annualLeave > 0 ? (totalUsed / annualLeave) * 100 : 0,
    };
  } catch (error) {
    console.error("연차 현황 조회 실패:", error);
    throw error;
  }
};

/**
 * 🏖️ 오늘 사용한 연차 조회
 */
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

/**
 * 🏖️ 연차 사용 이력 조회
 */
leaveSchema.statics.getLeaveHistory = async function (userId, options = {}) {
  const {
    limit = 20,
    skip = 0,
    year = null,
    type = null,
    status = "approved",
  } = options;

  // 필터 조건 구성
  const filter = {
    userId: userId.toString(),
    isActive: true,
  };

  if (year) filter.year = year;
  if (type) filter.leaveType = type;
  if (status) filter.status = status;

  try {
    const leaves = await this.find(filter)
      .sort({ usedDate: -1, createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    return leaves;
  } catch (error) {
    console.error("연차 이력 조회 실패:", error);
    throw error;
  }
};

/**
 * 📊 연도별 통계 조회
 */
leaveSchema.statics.getYearlyStats = async function (userId, year = null) {
  const targetYear = year || new Date().getFullYear();

  try {
    const stats = await this.aggregate([
      {
        $match: {
          userId: userId.toString(),
          year: targetYear,
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

    // 결과 정리
    const result = {
      year: targetYear,
      total: { days: 0, count: 0 },
      byType: {},
    };

    stats.forEach((stat) => {
      result.byType[stat._id] = {
        days: stat.totalDays,
        count: stat.count,
      };
      result.total.days += stat.totalDays;
      result.total.count += stat.count;
    });

    return result;
  } catch (error) {
    console.error("연도별 통계 조회 실패:", error);
    throw error;
  }
};

/**
 * 📊 월별 사용량 조회
 */
leaveSchema.statics.getMonthlyUsage = async function (userId, year = null) {
  const targetYear = year || new Date().getFullYear();

  try {
    const monthlyStats = await this.aggregate([
      {
        $match: {
          userId: userId.toString(),
          year: targetYear,
          isActive: true,
          status: "approved",
        },
      },
      {
        $group: {
          _id: { $month: "$usedDate" },
          totalDays: { $sum: "$days" },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // 12개월 배열 초기화
    const result = Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      days: 0,
      count: 0,
    }));

    // 실제 데이터 매핑
    monthlyStats.forEach((stat) => {
      const monthIndex = stat._id - 1;
      if (monthIndex >= 0 && monthIndex < 12) {
        result[monthIndex] = {
          month: stat._id,
          days: stat.totalDays,
          count: stat.count,
        };
      }
    });

    return result;
  } catch (error) {
    console.error("월별 사용량 조회 실패:", error);
    throw error;
  }
};

// ===== 🎯 미들웨어 =====

leaveSchema.pre("save", function (next) {
  // 연차 타입 자동 설정
  if (this.isModified("days") || this.isNew) {
    if (this.days === 0.25) {
      this.leaveType = "반반차";
    } else if (this.days === 0.5) {
      this.leaveType = "반차";
    } else if (this.days >= 1.0) {
      this.leaveType = "연차";
    }
  }

  // 연도 자동 설정
  if (this.isModified("usedDate") || this.isNew) {
    this.year = this.usedDate.getFullYear();
  }

  next();
});

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
