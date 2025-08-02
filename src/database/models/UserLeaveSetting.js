// src/database/models/UserLeaveSetting.js - 🏖️ DB 연결 완료 버전
const mongoose = require("mongoose");

/**
 * 👤 UserLeaveSetting - 사용자별 연차 설정 모델
 *
 * 🎯 용도:
 * - 사용자별 연간 연차 일수 설정
 * - 연차 관련 개인 설정 관리
 * - 회사별/부서별 연차 정책 적용
 *
 * ✅ 특징:
 * - 사용자당 하나의 설정 레코드
 * - 연도별 설정 가능
 * - 기본값 fallback 지원
 * - SoC 준수: 순수 데이터 스키마만
 */

const userLeaveSettingSchema = new mongoose.Schema(
  {
    // 👤 사용자 ID (고유) - ✅ 활성화!
    userId: {
      type: String,
      required: [true, "사용자 ID는 필수입니다"],
      trim: true,
      // 🎯 SoC: 인덱스는 별도로 정의 (중복 방지)
    },

    // 📊 연간 연차 일수
    annualLeave: {
      type: Number,
      required: [true, "연간 연차 일수는 필수입니다"],
      min: [1, "최소 1일 이상이어야 합니다"],
      max: [50, "최대 50일까지 설정 가능합니다"],
      default: function () {
        return parseInt(process.env.DEFAULT_ANNUAL_LEAVE) || 15; // ✅ 환경변수 우선
      },
    },

    // 📅 적용 연도 (옵션 - 미래 확장용)
    applicableYear: {
      type: Number,
      default: function () {
        return new Date().getFullYear(); // ✅ 수정: 올바른 년도 설정
      },
      min: [2020, "2020년 이후만 설정 가능합니다"],
      max: [2035, "2035년 이전까지만 설정 가능합니다"],
    },

    // 🏢 회사/부서 정보 (옵션 - 미래 확장용)
    company: {
      type: String,
      trim: true,
      maxlength: [100, "회사명은 100자를 초과할 수 없습니다"],
      default: "",
    },

    department: {
      type: String,
      trim: true,
      maxlength: [100, "부서명은 100자를 초과할 수 없습니다"],
      default: "",
    },

    // 👔 직급/경력 (연차 일수 자동 계산용 - 미래 확장)
    position: {
      type: String,
      enum: {
        values: [
          "intern",
          "junior",
          "senior",
          "lead",
          "manager",
          "director",
          "executive",
        ],
        message: "유효하지 않은 직급입니다",
      },
      default: "junior",
    },

    yearsOfService: {
      type: Number,
      min: [0, "경력은 0년 이상이어야 합니다"],
      max: [50, "경력은 50년 이하여야 합니다"],
      default: 0,
    },

    // ⚙️ 연차 정책 설정
    policy: {
      // 반차 사용 허용
      allowHalfDay: {
        type: Boolean,
        default: true,
      },

      // 반반차 사용 허용
      allowQuarterDay: {
        type: Boolean,
        default: true,
      },

      // 연차 이월 허용 (미래 기능)
      allowCarryOver: {
        type: Boolean,
        default: false,
      },

      // 최대 이월 일수
      maxCarryOverDays: {
        type: Number,
        min: [0, "이월 일수는 0일 이상이어야 합니다"],
        max: [10, "최대 10일까지 이월 가능합니다"],
        default: 0,
      },

      // 승인 필요 여부
      requireApproval: {
        type: Boolean,
        default: false,
      },
    },

    // 📅 특별 휴가 설정 (미래 확장)
    specialLeave: {
      // 생일 휴가
      birthdayLeave: {
        enabled: { type: Boolean, default: false },
        days: { type: Number, default: 0.5 },
      },

      // 리프레시 휴가
      refreshLeave: {
        enabled: { type: Boolean, default: false },
        days: { type: Number, default: 5 },
      },
    },

    // 🎯 메타데이터
    metadata: {
      // 설정 변경 이력
      lastModified: {
        type: Date,
        default: Date.now,
      },

      modifiedBy: {
        type: String,
        default: "user",
      },

      // 설정 소스
      source: {
        type: String,
        enum: ["user", "admin", "policy", "system"],
        default: "user",
      },

      // 노트
      notes: {
        type: String,
        maxlength: [500, "노트는 500자를 초과할 수 없습니다"],
        default: "",
      },
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
    collection: "user_leave_settings",
  }
);

// ===== 🎯 인덱스 정의 (성능 최적화) =====

// 🔥 핵심: 사용자별 고유 설정 (복합 고유 인덱스)
userLeaveSettingSchema.index(
  { userId: 1, applicableYear: 1 },
  {
    unique: true,
    name: "idx_user_year_unique",
  }
);

// 조회 최적화 인덱스
userLeaveSettingSchema.index({ userId: 1 }); // 사용자별 설정 조회
userLeaveSettingSchema.index({ applicableYear: 1 }); // 연도별 설정 조회
userLeaveSettingSchema.index({ company: 1, department: 1 }); // 조직별 조회
userLeaveSettingSchema.index({ updatedAt: -1 }); // 최근 수정순 조회
userLeaveSettingSchema.index({ isActive: 1 }); // 활성 상태별 조회

// ===== 🎯 가상 속성 (Virtual) - 단순 데이터 변환만 =====

// 연도 문자열 변환
userLeaveSettingSchema.virtual("yearString").get(function () {
  return this.applicableYear ? this.applicableYear.toString() : "";
});

// 설정 ID 문자열 변환
userLeaveSettingSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

// ===== 🎯 인스턴스 메서드 - 기본 CRUD만 =====

// 활성 상태 토글
userLeaveSettingSchema.methods.toggleActive = function () {
  this.isActive = !this.isActive;
  return this.save();
};

// 기본 정보 업데이트
userLeaveSettingSchema.methods.updateBasicInfo = function (updateData) {
  Object.assign(this, updateData);
  this.metadata.lastModified = new Date();
  return this.save();
};

// ===== 🚀 정적 메서드 - 순수 CRUD 및 조회만 =====

/**
 * 🎯 사용자 설정 조회 또는 생성 (핵심!)
 */
userLeaveSettingSchema.statics.getOrCreate = async function (
  userId,
  year = null
) {
  const currentYear = year || new Date().getFullYear();

  try {
    let setting = await this.findOne({
      userId: userId.toString(),
      applicableYear: currentYear,
      isActive: true,
    });

    if (!setting) {
      // 기본 설정으로 새 레코드 생성
      setting = new this({
        userId: userId.toString(),
        applicableYear: currentYear,
        annualLeave: parseInt(process.env.DEFAULT_ANNUAL_LEAVE) || 15,
        metadata: {
          source: "system",
          notes: "시스템에 의해 자동 생성됨",
        },
      });

      await setting.save();
    }

    return setting;
  } catch (error) {
    console.error("사용자 설정 조회/생성 실패:", error);
    throw error;
  }
};

/**
 * 🔍 사용자별 설정 조회
 */
userLeaveSettingSchema.statics.findByUserId = async function (
  userId,
  year = null
) {
  const query = {
    userId: userId.toString(),
    isActive: true,
  };

  if (year) {
    query.applicableYear = year;
  }

  return await this.find(query).sort({ applicableYear: -1 });
};

/**
 * 📊 기본 통계 조회
 */
userLeaveSettingSchema.statics.getBasicStats = async function (year = null) {
  const currentYear = year || new Date().getFullYear();

  return await this.aggregate([
    {
      $match: {
        applicableYear: currentYear,
        isActive: true,
      },
    },
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        avgAnnualLeave: { $avg: "$annualLeave" },
        minAnnualLeave: { $min: "$annualLeave" },
        maxAnnualLeave: { $max: "$annualLeave" },
      },
    },
  ]);
};

// ===== 🎯 미들웨어 - 기본 데이터 처리만 =====

// 저장 전 데이터 정규화
userLeaveSettingSchema.pre("save", function (next) {
  // userId 정규화
  if (this.userId) {
    this.userId = this.userId.toString().trim();
  }

  // 메타데이터 업데이트
  if (this.isModified() && !this.isNew) {
    this.metadata.lastModified = new Date();
  }

  next();
});

// ===== 🎯 JSON 변환 설정 =====

userLeaveSettingSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// ===== 🎯 모델 생성 및 내보내기 =====

const UserLeaveSetting = mongoose.model(
  "UserLeaveSetting",
  userLeaveSettingSchema
);

module.exports = UserLeaveSetting;
