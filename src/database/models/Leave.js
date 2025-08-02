// src/database/models/Leave.js - 개인용 연차 관리 모델
const mongoose = require("mongoose");

/**
 * 🏖️ Leave - 개인용 연차 사용 기록 모델
 *
 * 🎯 핵심 필드:
 * - userId: 사용자 ID
 * - year: 연도 (2025)
 * - date: 사용 날짜 (2025-07-15)
 * - amount: 사용량 (0.25 ~ 10일, 0.25 단위)
 * - type: 타입 (반반차, 반차, 연차, 연차 X일)
 * - reason: 사유 (선택)
 */
const leaveSchema = new mongoose.Schema(
  {
    // 👤 사용자 ID
    userId: {
      type: String,
      required: [true, "사용자 ID는 필수입니다"],
      trim: true,
      index: true,
    },

    // 📅 연도
    year: {
      type: Number,
      required: [true, "연도는 필수입니다"],
      min: [2020, "2020년 이후만 가능합니다"],
      max: [2030, "2030년 이전만 가능합니다"],
      default: () => new Date().getFullYear(),
    },

    // 📅 사용 날짜
    date: {
      type: Date,
      required: [true, "사용 날짜는 필수입니다"],
      default: Date.now,
    },

    // 📊 사용량 - 유연하게 변경
    amount: {
      type: Number,
      required: [true, "사용량은 필수입니다"],
      min: [0.25, "최소 0.25일입니다"],
      max: [10, "최대 10일까지 가능합니다"],
      validate: {
        validator: function (v) {
          // 0.25 단위로만 허용
          return (v * 4) % 1 === 0;
        },
        message: "연차는 0.25일 단위로만 사용 가능합니다",
      },
    },

    // 🏷️ 연차 타입 - 유연하게 변경
    type: {
      type: String,
      required: [true, "연차 타입은 필수입니다"],
      maxlength: [20, "타입은 20자 이내여야 합니다"],
      // enum 제거 - 자유로운 값 허용
    },

    // 📝 사유 (선택사항)
    reason: {
      type: String,
      trim: true,
      maxlength: [100, "사유는 100자 이하로 입력해주세요"],
      default: "",
    },

    // 🔄 활성 상태
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

// ===== 🎯 인덱스 설정 =====
leaveSchema.index({ userId: 1, year: -1 }); // 사용자별, 연도별 조회
leaveSchema.index({ userId: 1, date: -1 }); // 사용자별, 날짜별 조회
leaveSchema.index({ userId: 1, year: 1, isActive: 1 }); // 활성 데이터 조회

// ===== 🎯 가상 속성 =====
leaveSchema.virtual("month").get(function () {
  return this.date ? this.date.getMonth() + 1 : null;
});

leaveSchema.virtual("formattedDate").get(function () {
  return this.date ? this.date.toISOString().split("T")[0] : null;
});

// ===== 🎯 Hooks =====
leaveSchema.pre("save", function (next) {
  // 날짜에서 연도 자동 추출
  if (this.date && !this.year) {
    this.year = this.date.getFullYear();
  }
  next();
});

// ===== 🎯 Static 메서드 =====

/**
 * 📊 사용자의 연간 연차 사용 현황 조회
 */
leaveSchema.statics.getYearlyUsage = async function (userId, year) {
  const targetYear = year || new Date().getFullYear();

  const leaves = await this.find({
    userId: String(userId),
    year: targetYear,
    isActive: true,
  }).sort({ date: -1 });

  // 총 사용량 계산
  const totalUsed = leaves.reduce((sum, leave) => sum + leave.amount, 0);

  // 월별 사용량 계산
  const monthlyUsage = {};
  for (let i = 1; i <= 12; i++) {
    monthlyUsage[i] = 0;
  }

  leaves.forEach((leave) => {
    const month = leave.date.getMonth() + 1;
    monthlyUsage[month] += leave.amount;
  });

  return {
    year: targetYear,
    totalUsed,
    monthlyUsage,
    details: leaves,
  };
};

/**
 * 📊 월별 사용량 조회 (수정된 버전)
 */
leaveSchema.statics.getMonthlyUsage = async function (userId, year = null) {
  const targetYear = year || new Date().getFullYear();

  try {
    const monthlyStats = await this.aggregate([
      {
        // 1. 특정 사용자와 연도에 해당하는 데이터만 필터링합니다.
        $match: {
          userId: userId.toString(),
          year: targetYear,
          isActive: true,
          status: "approved",
        },
      },
      {
        // 2. 월별 그룹을 만들면서, 'days'와 'amount' 필드를 모두 고려하여 합산합니다.
        $group: {
          _id: { $month: "$usedDate" },
          // 👇 *** 바로 이 부분이 수정되었습니다! ***
          // days 필드가 없으면 amount 필드를 사용하도록 하여 이전 데이터도 집계합니다.
          totalDays: { $sum: { $ifNull: ["$days", "$amount"] } },
          count: { $sum: 1 },
        },
      },
      {
        // 3. 월(1-12) 기준으로 오름차순 정렬합니다.
        $sort: { _id: 1 },
      },
    ]);

    // 4. 최종 결과를 1월부터 12월까지의 배열 형식으로 가공합니다.
    const result = Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      days: 0,
      count: 0,
    }));

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

/**
 * ➕ 연차 사용 기록 추가
 */
leaveSchema.statics.addUsage = async function (
  userId,
  amount,
  date,
  reason,
  type
) {
  const useDate = date ? new Date(date) : new Date();

  // ✅ type이 전달되지 않으면 자동 계산
  let leaveType = type;
  if (!leaveType) {
    if (amount === 0.25) {
      leaveType = "반반차";
    } else if (amount === 0.5) {
      leaveType = "반차";
    } else if (amount === 1) {
      leaveType = "연차";
    } else {
      leaveType = `연차 ${amount}일`;
    }
  }

  const leave = new this({
    userId: String(userId),
    date: useDate,
    amount: amount,
    type: leaveType,
    reason: reason,
  });

  return await leave.save();
};

/**
 * 🗑️ 연차 사용 기록 삭제 (소프트 삭제)
 */
leaveSchema.statics.removeUsage = async function (userId, leaveId) {
  return await this.findOneAndUpdate(
    { _id: leaveId, userId: String(userId) },
    { isActive: false },
    { new: true }
  );
};

// ===== 🎯 JSON 변환 설정 =====
leaveSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

const Leave = mongoose.model("Leave", leaveSchema);
module.exports = Leave;
