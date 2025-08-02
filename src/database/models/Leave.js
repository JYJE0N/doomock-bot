// src/database/models/Leave.js - 🏖️ 순수 CRUD 스키마
const mongoose = require("mongoose");

/**
 * 🏖️ Leave - 연차 사용 기록 모델
 *
 * 🎯 순수 데이터 스키마:
 * - 연차/반차/반반차 사용 기록
 * - 사용 날짜와 기본 메타데이터
 * - 순수 CRUD 기능만 제공
 * - 비즈니스 로직은 Service 계층에서 처리
 */

const leaveSchema = new mongoose.Schema(
  {
    // 👤 사용자 ID
    userId: {
      type: String,
      required: [true, "사용자 ID는 필수입니다"],
      trim: true,
    },

    // 📅 연도
    year: {
      type: Number,
      required: [true, "연도는 필수입니다"],
      min: [2020, "2020년 이후만 입력 가능합니다"],
      max: [2030, "2030년 이전만 입력 가능합니다"],
      default: function () {
        return new Date().getFullYear(); // ✅ TimeHelper 대신 직접 처리 (더 안전)
      },
    },

    // 📊 사용 일수 (0.25, 0.5, 1.0 등)
    days: {
      type: Number,
      required: [true, "사용 일수는 필수입니다"],
      validate: {
        validator: function (value) {
          // 0.25일 단위만 허용 (0.25, 0.5, 0.75, 1.0, 1.25, ...)
          return value > 0 && (value * 4) % 1 === 0;
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

    // ✅ 상태
    status: {
      type: String,
      enum: {
        values: ["approved", "pending", "cancelled"],
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

// ===== 🎯 가상 속성 - 단순 데이터 변환만 =====
leaveSchema.virtual("usedMonth").get(function () {
  return this.usedDate ? this.usedDate.getMonth() + 1 : null;
});

leaveSchema.virtual("formattedUsedDate").get(function () {
  return this.usedDate ? this.usedDate.toISOString().split("T")[0] : null;
});

leaveSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

// ===== 🎯 인스턴스 메서드 - 기본 CRUD만 =====

// 상태 변경
leaveSchema.methods.updateStatus = function (newStatus) {
  this.status = newStatus;
  return this.save();
};

// 활성 상태 토글
leaveSchema.methods.toggleActive = function () {
  this.isActive = !this.isActive;
  return this.save();
};

// ===== 🚀 정적 메서드 - 순수 조회 기능만 =====

/**
 * 🔍 사용자별 연차 기록 조회
 */
leaveSchema.statics.findByUser = async function (userId, options = {}) {
  const {
    year = null,
    status = null,
    limit = 20,
    skip = 0,
    sort = { usedDate: -1 },
  } = options;

  const query = {
    userId: userId.toString(),
    isActive: true,
  };

  if (year) query.year = year;
  if (status) query.status = status;

  return await this.find(query).sort(sort).limit(limit).skip(skip).lean();
};

/**
 * 📊 사용자별 연차 합계 조회
 */
leaveSchema.statics.getTotalUsage = async function (userId, year = null) {
  const currentYear = year || new Date().getFullYear();

  const result = await this.aggregate([
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
        _id: null,
        totalDays: { $sum: "$days" },
        totalRecords: { $sum: 1 },
      },
    },
  ]);

  return result[0] || { totalDays: 0, totalRecords: 0 };
};

/**
 * 📅 날짜별 연차 사용 조회
 */
leaveSchema.statics.findByDate = async function (userId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return await this.find({
    userId: userId.toString(),
    usedDate: { $gte: startOfDay, $lte: endOfDay },
    isActive: true,
  }).lean();
};

/**
 * 📈 월별 사용량 통계
 */
leaveSchema.statics.getMonthlyUsage = async function (userId, year) {
  const result = await this.aggregate([
    {
      $match: {
        userId: userId.toString(),
        year: year,
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

  // 12개월 데이터로 정규화
  const monthlyData = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    days: 0,
    count: 0,
  }));

  result.forEach((stat) => {
    const monthIndex = stat._id - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      monthlyData[monthIndex] = {
        month: stat._id,
        days: stat.totalDays,
        count: stat.count,
      };
    }
  });

  return monthlyData;
};

/**
 * 📊 기본 통계
 */
leaveSchema.statics.getBasicStats = async function (filters = {}) {
  const matchQuery = { isActive: true };

  if (filters.year) matchQuery.year = filters.year;
  if (filters.status) matchQuery.status = filters.status;

  return await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalRecords: { $sum: 1 },
        totalDays: { $sum: "$days" },
        avgDays: { $avg: "$days" },
        uniqueUsers: { $addToSet: "$userId" },
      },
    },
    {
      $project: {
        totalRecords: 1,
        totalDays: 1,
        avgDays: { $round: ["$avgDays", 2] },
        uniqueUserCount: { $size: "$uniqueUsers" },
      },
    },
  ]);
};

// ===== 🎯 미들웨어 - 기본 데이터 처리만 =====

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

  // userId 정규화
  if (this.userId) {
    this.userId = this.userId.toString().trim();
  }

  next();
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
