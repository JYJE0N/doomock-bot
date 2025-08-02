// src/database/models/Leave.js - 개인용 연차 관리 모델
const mongoose = require("mongoose");

/**
 * 🏖️ Leave - 개인용 연차 사용 기록 모델
 *
 * 🎯 핵심 필드:
 * - userId: 사용자 ID
 * - year: 연도 (2025)
 * - date: 사용 날짜 (2025-07-15)
 * - amount: 사용량 (1, 0.5, 0.25)
 * - type: 타입 (연차, 반차, 반반차)
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

    // 📊 사용량 (1, 0.5, 0.25)
    amount: {
      type: Number,
      required: [true, "사용량은 필수입니다"],
      enum: {
        values: [0.25, 0.5, 1],
        message: "0.25일, 0.5일, 1일만 가능합니다",
      },
    },

    // 🏷️ 연차 타입
    type: {
      type: String,
      enum: {
        values: ["반반차", "반차", "연차"],
        message: "반반차, 반차, 연차만 가능합니다",
      },
      required: [true, "연차 타입은 필수입니다"],
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

// ===== 🎯 미들웨어 =====
leaveSchema.pre("save", function (next) {
  // 연차 타입 자동 설정
  if (this.amount === 0.25) {
    this.type = "반반차";
  } else if (this.amount === 0.5) {
    this.type = "반차";
  } else if (this.amount === 1) {
    this.type = "연차";
  }

  // 연도 자동 설정
  if (this.date) {
    this.year = this.date.getFullYear();
  }

  next();
});

// ===== 🎯 정적 메서드 =====

/**
 * 📊 사용자의 연간 연차 사용량 조회
 */
leaveSchema.statics.getUserYearlyUsage = async function (userId, year = null) {
  const targetYear = year || new Date().getFullYear();

  const result = await this.aggregate([
    {
      $match: {
        userId: String(userId),
        year: targetYear,
        isActive: true,
      },
    },
    {
      $group: {
        _id: null,
        totalUsed: { $sum: "$amount" },
        totalCount: { $sum: 1 },
      },
    },
  ]);

  return result[0] || { totalUsed: 0, totalCount: 0 };
};

/**
 * 📈 월별 사용량 조회
 */
leaveSchema.statics.getMonthlyUsage = async function (userId, year = null) {
  const targetYear = year || new Date().getFullYear();

  const result = await this.aggregate([
    {
      $match: {
        userId: String(userId),
        year: targetYear,
        isActive: true,
      },
    },
    {
      $group: {
        _id: { $month: "$date" },
        days: { $sum: "$amount" },
        count: { $sum: 1 },
        details: {
          $push: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
            type: "$type",
            amount: "$amount",
            reason: "$reason",
          },
        },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  // 12개월 데이터로 정규화
  const monthlyData = [];
  for (let month = 1; month <= 12; month++) {
    const data = result.find((r) => r._id === month);
    monthlyData.push({
      month,
      days: data ? data.days : 0,
      count: data ? data.count : 0,
      details: data ? data.details : [],
    });
  }

  return monthlyData;
};

/**
 * 📅 특정 날짜 사용량 조회
 */
leaveSchema.statics.getDateUsage = async function (userId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return await this.find({
    userId: String(userId),
    date: { $gte: startOfDay, $lte: endOfDay },
    isActive: true,
  }).lean();
};

/**
 * ➕ 연차 사용 기록 추가
 */
leaveSchema.statics.addUsage = async function (
  userId,
  amount,
  date = null,
  reason = "",
  type = null // ✅ 추가: type 매개변수
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
      throw new Error(`잘못된 연차 사용량: ${amount}일`);
    }
  }

  const leave = new this({
    userId: String(userId),
    date: useDate,
    amount: amount,
    type: leaveType, // ✅ 수정: type 필드 명시적 설정
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
