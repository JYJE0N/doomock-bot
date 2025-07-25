// src/database/schemas/LeaveSchema.js - 휴가 관리 데이터베이스 스키마

/**
 * 🏖️ 휴가 관리 MongoDB 컬렉션 스키마
 * 컬렉션명: leave_management
 *
 * ⭐ 표준화된 휴가 타입 시스템
 * - ANNUAL: 연차 (1일, 0.5일, 0.25일)
 * - MONTHLY: 월차 (1일, 0.5일, 0.25일)
 * - HALF_DAY: 반차 (0.5일 고정)
 * - QUARTER_DAY: 반반차 (0.25일 고정)
 * - SICK: 병가 (차감 없음)
 */

const LeaveUserSchema = {
  // 🔑 기본 식별자
  userKey: String, // "${userId}_${year}" 형태의 유니크 키
  userId: Number, // 텔레그램 사용자 ID
  year: Number, // 연도 (2025, 2026...)

  // 📊 전체 휴가 현황
  totalLeaves: Number, // 총 연차 일수 (기본 15일)
  usedLeaves: Number, // 사용한 연차 일수
  remainingLeaves: Number, // 잔여 연차 일수

  // 🏷️ 휴가 타입별 상세 현황
  leavesByType: {
    ANNUAL: {
      total: Number, // 배정된 연차 (15일)
      used: Number, // 사용한 연차
      remaining: Number, // 잔여 연차
    },
    MONTHLY: {
      total: Number, // 월차 총량 (12일)
      used: Number, // 사용한 월차
      remaining: Number, // 잔여 월차
      monthlyAllocation: [
        {
          // 월별 지급 내역
          month: Number, // 월 (1-12)
          allocated: Number, // 지급된 일수
          allocatedAt: Date, // 지급 날짜
        },
      ],
    },
    SICK: {
      total: Number, // 병가 한도 (10일)
      used: Number, // 사용한 병가
      remaining: Number, // 잔여 병가
    },
  },

  // 📋 휴가 사용 내역
  leaveHistory: [
    {
      id: String, // 휴가 기록 고유 ID
      date: Date, // 신청/사용 날짜
      leaveType: String, // 휴가 타입 (ANNUAL, MONTHLY, etc.)
      typeName: String, // 휴가 타입 한글명 (연차, 월차, etc.)
      emoji: String, // 휴가 타입 이모지

      // 📏 사용량 정보
      requestedDays: Number, // 신청한 일수 (1, 0.5, 0.25)
      deductedDays: Number, // 실제 차감된 일수 (병가는 0)

      // ⏰ 시간 정보
      timeRange: String, // 시간대 (09:00-18:00, etc.)
      timeType: String, // 시간 구분 (전일, 오전, 오후, etc.)

      // 📝 신청 정보
      reason: String, // 휴가 사유
      status: String, // 상태 (APPROVED, PENDING, REJECTED)

      // 📊 메타데이터
      createdAt: Date, // 신청 일시
      approvedAt: Date, // 승인 일시
      approvedBy: String, // 승인자 (자동승인: "SYSTEM")

      // 🏥 병가 특수 필드
      medicalCertificate: Boolean, // 진단서 첨부 여부
      doctorNote: String, // 의사 소견

      // 🔄 수정/취소 이력
      modifiedAt: Date, // 마지막 수정 일시
      cancelledAt: Date, // 취소 일시
      cancelReason: String, // 취소 사유
    },
  ],

  // ⚙️ 사용자 설정
  settings: {
    autoApproval: Boolean, // 자동 승인 여부
    notificationEnabled: Boolean, // 알림 활성화
    preferredLeaveType: String, // 선호 휴가 타입
    workSchedule: {
      startTime: String, // 근무 시작 시간 (09:00)
      endTime: String, // 근무 종료 시간 (18:00)
      lunchStart: String, // 점심 시작 (12:00)
      lunchEnd: String, // 점심 종료 (13:00)
    },
  },

  // 📊 통계 정보 (캐시된 데이터)
  statistics: {
    thisMonth: {
      used: Number, // 이번 달 사용량
      mostUsedType: String, // 가장 많이 사용한 타입
    },
    lastMonth: {
      used: Number,
      mostUsedType: String,
    },
    totalUsageByType: {
      // 전체 타입별 사용량
      ANNUAL: Number,
      MONTHLY: Number,
      HALF_DAY: Number,
      QUARTER_DAY: Number,
      SICK: Number,
    },
    averageUsagePerMonth: Number, // 월평균 사용량
    lastCalculatedAt: Date, // 마지막 계산 일시
  },

  // 🕒 타임스탬프
  createdAt: Date, // 계정 생성일
  updatedAt: Date, // 마지막 업데이트
  lastAccessAt: Date, // 마지막 접근일
};

/**
 * 🔍 인덱스 설정
 */
const LeaveIndexes = [
  // 기본 인덱스
  { userKey: 1 }, // 유니크 인덱스
  { userId: 1, year: 1 }, // 사용자별 연도 조회

  // 성능 최적화 인덱스
  { "leaveHistory.date": -1 }, // 날짜별 내역 조회
  { "leaveHistory.leaveType": 1 }, // 타입별 내역 조회
  { "leaveHistory.status": 1 }, // 상태별 조회

  // 통계 인덱스
  { "statistics.lastCalculatedAt": 1 }, // 통계 계산용
  { updatedAt: -1 }, // 최신 업데이트 조회

  // 복합 인덱스
  { userId: 1, "leaveHistory.date": -1 }, // 사용자별 최신 내역
  { year: 1, "statistics.thisMonth.used": -1 }, // 연도별 사용량 순위
];

/**
 * 🎯 휴가 타입 정의 (상수)
 */
const LeaveTypes = {
  ANNUAL: {
    code: "ANNUAL",
    name: "연차",
    emoji: "🏖️",
    allowedDays: [1, 0.5, 0.25],
    deductionRate: 1.0,
    requiresApproval: false,
    description: "1년간 사용할 수 있는 유급휴가",
  },
  MONTHLY: {
    code: "MONTHLY",
    name: "월차",
    emoji: "📅",
    allowedDays: [1, 0.5, 0.25],
    deductionRate: 1.0,
    requiresApproval: false,
    description: "매월 1일씩 자동 지급되는 휴가",
  },
  HALF_DAY: {
    code: "HALF_DAY",
    name: "반차",
    emoji: "🌅",
    allowedDays: [0.5],
    deductionRate: 0.5,
    requiresApproval: false,
    description: "반나절 휴가 (오전/오후)",
  },
  QUARTER_DAY: {
    code: "QUARTER_DAY",
    name: "반반차",
    emoji: "⏰",
    allowedDays: [0.25],
    deductionRate: 0.25,
    requiresApproval: false,
    description: "2시간 단위 휴가",
  },
  SICK: {
    code: "SICK",
    name: "병가",
    emoji: "🤒",
    allowedDays: [1, 0.5, 0.25],
    deductionRate: 0, // 차감 없음
    requiresApproval: true,
    description: "질병으로 인한 휴가 (연차 차감 없음)",
  },
};

/**
 * ⏰ 사용 단위 정의
 */
const UsageUnits = {
  1: {
    name: "1일",
    display: "하루종일",
    timeRange: "09:00-18:00",
    hours: 8,
    description: "전일 휴가",
  },
  0.5: {
    name: "0.5일",
    display: "반나절",
    timeRange: "09:00-13:00 또는 14:00-18:00",
    hours: 4,
    description: "반일 휴가",
    options: [
      { type: "morning", range: "09:00-13:00", name: "오전반차" },
      { type: "afternoon", range: "14:00-18:00", name: "오후반차" },
    ],
  },
  0.25: {
    name: "0.25일",
    display: "반반나절",
    timeRange: "09:00-11:00 또는 16:00-18:00",
    hours: 2,
    description: "2시간 휴가",
    options: [
      { type: "early_morning", range: "09:00-11:00", name: "출근후반반차" },
      { type: "late_afternoon", range: "16:00-18:00", name: "퇴근전반반차" },
    ],
  },
};

/**
 * 📊 휴가 상태 정의
 */
const LeaveStatus = {
  PENDING: {
    code: "PENDING",
    name: "대기중",
    emoji: "⏳",
    description: "승인 대기 중",
  },
  APPROVED: {
    code: "APPROVED",
    name: "승인됨",
    emoji: "✅",
    description: "승인되어 사용 가능",
  },
  REJECTED: {
    code: "REJECTED",
    name: "거절됨",
    emoji: "❌",
    description: "승인 거절됨",
  },
  CANCELLED: {
    code: "CANCELLED",
    name: "취소됨",
    emoji: "🚫",
    description: "사용자가 취소함",
  },
  USED: {
    code: "USED",
    name: "사용완료",
    emoji: "✨",
    description: "휴가 사용 완료",
  },
};

/**
 * 🎯 데이터 검증 규칙
 */
const ValidationRules = {
  // 사용자 ID 검증
  userId: {
    required: true,
    type: "number",
    min: 1,
    max: 2147483647,
  },

  // 휴가 일수 검증
  days: {
    required: true,
    type: "number",
    allowedValues: [0.25, 0.5, 1],
    custom: (value, leaveType) => {
      const typeConfig = LeaveTypes[leaveType];
      return typeConfig && typeConfig.allowedDays.includes(value);
    },
  },

  // 휴가 타입 검증
  leaveType: {
    required: true,
    type: "string",
    allowedValues: Object.keys(LeaveTypes),
  },

  // 사유 검증
  reason: {
    required: false,
    type: "string",
    maxLength: 100,
    trim: true,
  },
};

/**
 * 🛠️ 스키마 유틸리티 함수
 */
const SchemaUtils = {
  // 기본 사용자 데이터 생성
  createDefaultUserData(userId, year = new Date().getFullYear()) {
    return {
      userKey: `${userId}_${year}`,
      userId,
      year,
      totalLeaves: 15,
      usedLeaves: 0,
      remainingLeaves: 15,
      leavesByType: {
        ANNUAL: { total: 15, used: 0, remaining: 15 },
        MONTHLY: {
          total: 12,
          used: 0,
          remaining: 12,
          monthlyAllocation: [],
        },
        SICK: { total: 10, used: 0, remaining: 10 },
      },
      leaveHistory: [],
      settings: {
        autoApproval: true,
        notificationEnabled: true,
        preferredLeaveType: "ANNUAL",
        workSchedule: {
          startTime: "09:00",
          endTime: "18:00",
          lunchStart: "12:00",
          lunchEnd: "13:00",
        },
      },
      statistics: {
        thisMonth: { used: 0, mostUsedType: null },
        lastMonth: { used: 0, mostUsedType: null },
        totalUsageByType: {
          ANNUAL: 0,
          MONTHLY: 0,
          HALF_DAY: 0,
          QUARTER_DAY: 0,
          SICK: 0,
        },
        averageUsagePerMonth: 0,
        lastCalculatedAt: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastAccessAt: new Date(),
    };
  },

  // 휴가 기록 생성
  createLeaveRecord(leaveType, days, reason = "") {
    const typeConfig = LeaveTypes[leaveType];
    const unitConfig = UsageUnits[days];

    return {
      id: `leave_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      date: new Date(),
      leaveType,
      typeName: typeConfig.name,
      emoji: typeConfig.emoji,
      requestedDays: days,
      deductedDays: days * typeConfig.deductionRate,
      timeRange: unitConfig.timeRange,
      timeType: unitConfig.display,
      reason: reason.trim(),
      status: typeConfig.requiresApproval ? "PENDING" : "APPROVED",
      createdAt: new Date(),
      approvedAt: typeConfig.requiresApproval ? null : new Date(),
      approvedBy: typeConfig.requiresApproval ? null : "SYSTEM",
      medicalCertificate: leaveType === "SICK" ? false : undefined,
      doctorNote: leaveType === "SICK" ? "" : undefined,
    };
  },

  // 데이터 검증
  validateLeaveRequest(userId, leaveType, days, reason) {
    const errors = [];

    // 사용자 ID 검증
    if (
      !ValidationRules.userId.custom ||
      !ValidationRules.userId.custom(userId)
    ) {
      errors.push("유효하지 않은 사용자 ID입니다.");
    }

    // 휴가 타입 검증
    if (!ValidationRules.leaveType.allowedValues.includes(leaveType)) {
      errors.push("지원하지 않는 휴가 타입입니다.");
    }

    // 일수 검증
    if (!ValidationRules.days.allowedValues.includes(days)) {
      errors.push("지원하지 않는 휴가 일수입니다.");
    }

    // 타입별 일수 호환성 검증
    if (leaveType && days) {
      const typeConfig = LeaveTypes[leaveType];
      if (typeConfig && !typeConfig.allowedDays.includes(days)) {
        errors.push(
          `${typeConfig.name}은 ${typeConfig.allowedDays.join(
            ", "
          )}일만 사용 가능합니다.`
        );
      }
    }

    // 사유 검증
    if (reason && reason.length > ValidationRules.reason.maxLength) {
      errors.push(
        `사유는 ${ValidationRules.reason.maxLength}자 이내로 입력해주세요.`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },
};

module.exports = {
  LeaveUserSchema,
  LeaveIndexes,
  LeaveTypes,
  UsageUnits,
  LeaveStatus,
  ValidationRules,
  SchemaUtils,
};
