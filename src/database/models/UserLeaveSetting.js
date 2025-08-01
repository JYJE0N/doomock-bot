// src/database/models/UserLeaveSetting.js - 사용자 연차 설정 모델 (완전 버전)
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
 */

const userLeaveSettingSchema = new mongoose.Schema(
  {
    // 👤 사용자 ID (고유)
    // userId: {
    //   type: String,
    //   required: [true, "사용자 ID는 필수입니다"],
    //   index: true,
    // },

    // 📊 연간 연차 일수
    annualLeave: {
      type: Number,
      required: [true, "연간 연차 일수는 필수입니다"],
      min: [1, "최소 1일 이상이어야 합니다"],
      max: [50, "최대 50일까지 설정 가능합니다"],
      default: 15,
    },

    // 📅 적용 연도 (옵션 - 미래 확장용)
    applicableYear: {
      type: Number,
      default: function () {
        return new Date().getFullYear();
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

// ===== 🎯 인덱스 정의 =====

// 사용자별 고유 설정 (복합 고유 인덱스)
userLeaveSettingSchema.index(
  { userId: 1, applicableYear: 1 },
  { unique: true }
);

// 조회 최적화 인덱스
userLeaveSettingSchema.index({ userId: 1 }); // 사용자별 설정 조회
userLeaveSettingSchema.index({ applicableYear: 1 }); // 연도별 설정 조회
userLeaveSettingSchema.index({ company: 1, department: 1 }); // 조직별 조회
userLeaveSettingSchema.index({ updatedAt: -1 }); // 최근 수정순 조회

// ===== 🎯 가상 속성 (Virtual) =====

// 연차 등급 계산 (경력 기준)
userLeaveSettingSchema.virtual("leaveGrade").get(function () {
  if (this.yearsOfService >= 10) return "senior";
  if (this.yearsOfService >= 5) return "intermediate";
  if (this.yearsOfService >= 1) return "junior";
  return "newcomer";
});

// 추천 연차 일수 (경력 기준)
userLeaveSettingSchema.virtual("recommendedAnnualLeave").get(function () {
  const baseLeave = 15;
  const bonusLeave = Math.floor(this.yearsOfService / 3) * 2; // 3년마다 2일 추가
  return Math.min(baseLeave + bonusLeave, 25); // 최대 25일
});

// 정책 활성화 여부
userLeaveSettingSchema.virtual("hasPolicyRestrictions").get(function () {
  return (
    this.policy.requireApproval ||
    !this.policy.allowHalfDay ||
    !this.policy.allowQuarterDay
  );
});

// ===== 🎯 인스턴스 메서드 =====

// 연차 일수 업데이트
userLeaveSettingSchema.methods.updateAnnualLeave = function (
  newDays,
  modifiedBy = "user"
) {
  this.annualLeave = newDays;
  this.metadata.lastModified = new Date();
  this.metadata.modifiedBy = modifiedBy;
  return this.save();
};

// 정책 업데이트
userLeaveSettingSchema.methods.updatePolicy = function (policyUpdates) {
  this.policy = { ...this.policy, ...policyUpdates };
  this.metadata.lastModified = new Date();
  return this.save();
};

// 설정 유효성 검증
userLeaveSettingSchema.methods.validateSettings = function () {
  const errors = [];

  if (this.annualLeave < 1 || this.annualLeave > 50) {
    errors.push("연차 일수는 1-50일 사이여야 합니다");
  }

  if (this.policy.maxCarryOverDays > this.annualLeave * 0.5) {
    errors.push("이월 가능 일수는 연차의 50%를 초과할 수 없습니다");
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
};

// ===== 🚀 핵심 정적 메서드 (Static Methods) =====

/**
 * 🎯 사용자 설정 조회 또는 생성 (핵심 메서드!)
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
        annualLeave: parseInt(process.env.DEFAULT_ANNUAL_LEAVE) || 15, // 환경변수에서 기본값
        metadata: {
          source: "system",
          notes: "시스템에 의해 자동 생성됨",
        },
      });

      await setting.save();
      console.log(
        `📋 새 사용자 연차 설정 생성: ${userId} - ${setting.annualLeave}일`
      );
    }

    return setting;
  } catch (error) {
    console.error("사용자 설정 조회/생성 실패:", error);
    throw error;
  }
};

/**
 * 회사/부서별 설정 조회
 */
userLeaveSettingSchema.statics.getByOrganization = async function (
  company,
  department = null
) {
  const query = { company: company, isActive: true };

  if (department) {
    query.department = department;
  }

  return await this.find(query).sort({ updatedAt: -1 });
};

/**
 * 연차 일수별 사용자 통계
 */
userLeaveSettingSchema.statics.getLeaveDistribution = async function (
  year = null
) {
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
        _id: "$annualLeave",
        userCount: { $sum: 1 },
        avgYearsOfService: { $avg: "$yearsOfService" },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);
};

/**
 * 경력별 평균 연차
 */
userLeaveSettingSchema.statics.getAverageLeaveByExperience = async function () {
  return await this.aggregate([
    {
      $match: { isActive: true },
    },
    {
      $bucket: {
        groupBy: "$yearsOfService",
        boundaries: [0, 1, 3, 5, 10, 20, 50],
        default: "other",
        output: {
          avgAnnualLeave: { $avg: "$annualLeave" },
          userCount: { $sum: 1 },
          minLeave: { $min: "$annualLeave" },
          maxLeave: { $max: "$annualLeave" },
        },
      },
    },
  ]);
};

// ===== 🎯 미들웨어 =====

// 저장 전 검증
userLeaveSettingSchema.pre("save", function (next) {
  // 메타데이터 업데이트
  if (this.isModified() && !this.isNew) {
    this.metadata.lastModified = new Date();
  }

  // 정책 일관성 검증
  if (this.policy.maxCarryOverDays > 0 && !this.policy.allowCarryOver) {
    this.policy.allowCarryOver = true;
  }

  next();
});

// 업데이트 후 로깅
userLeaveSettingSchema.post("save", function (doc) {
  console.log(
    `📋 사용자 연차 설정 업데이트: ${doc.userId} - ${doc.annualLeave}일`
  );
});

// ===== 🎯 JSON 변환 설정 =====

userLeaveSettingSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;

    // 민감한 정보 제거 (필요시)
    if (ret.metadata) {
      delete ret.metadata.modifiedBy;
    }

    return ret;
  },
});

// ===== 🎯 모델 생성 및 내보내기 =====

const UserLeaveSetting = mongoose.model(
  "UserLeaveSetting",
  userLeaveSettingSchema
);

module.exports = UserLeaveSetting;
