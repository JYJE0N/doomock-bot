// src/database/models/Timer.js - 🍅 완전 리팩토링 v2.0

const mongoose = require("mongoose");
const TimeHelper = require("../../utils/TimeHelper");
const logger = require("../../utils/Logger");

/**
 * 🍅 Timer Mongoose 스키마 - 뽀모도로 타이머 세션 (완전 표준 준수)
 *
 * ✅ 표준 기능:
 * - 세션 상태 관리 (active, paused, completed, stopped)
 * - 시간 추적 (시작, 일시정지, 재개, 완료)
 * - 진행률 추적
 * - 통계 집계 지원
 * - 인덱스 최적화
 *
 * ✨ 새로운 기능:
 * - 실시간 업데이트 지원
 * - 세션 복구 기능
 * - 자동 통계 업데이트
 * - 성능 최적화
 */

const timerSchema = new mongoose.Schema(
  {
    // 👤 사용자 정보
    userId: {
      type: String,
      required: true,
      index: true
    },
    userName: {
      type: String,
      required: true,
      trim: true
    },

    // 🍅 타이머 설정 (여기로 통합 및 수정)
    type: {
      type: String,
      enum: {
        values: ["focus", "shortBreak", "longBreak", "custom"], // custom 추가
        message:
          "타이머 타입은 focus, shortBreak, longBreak, custom 중 하나여야 합니다."
      },
      default: "focus",
      required: [true, "타이머 타입은 필수입니다."],
      index: true
    },
    duration: {
      type: Number,
      required: [true, "타이머 지속시간은 필수입니다."],
      min: [1, "타이머는 최소 1분 이상이어야 합니다."],
      max: [180, "타이머는 최대 180분(3시간)까지 가능합니다."]
    },

    // 📊 상태 관리
    status: {
      type: String,
      enum: {
        values: ["active", "paused", "completed", "stopped", "abandoned"], // 'abandoned' 추가
        message:
          "상태는 active, paused, completed, stopped, abandoned 중 하나여야 합니다."
      },
      default: "active",
      required: [true, "상태는 필수입니다."],
      index: true
    },

    // ⏰ 시간 추적
    startedAt: {
      type: Date,
      required: [true, "시작 시간은 필수입니다"],
      default: Date.now,
      index: true
    },
    completedAt: {
      type: Date,
      default: null
    },
    stoppedAt: {
      type: Date,
      default: null
    },

    // ⏸️ 일시정지 관리
    pausedAt: {
      type: Date,
      default: null
    },
    resumedAt: {
      type: Date,
      default: null
    },
    totalPausedDuration: {
      type: Number, // 밀리초
      default: 0,
      min: [0, "일시정지 시간은 음수일 수 없습니다"]
    },

    // 📈 진행률 추적
    lastProgress: {
      remainingTime: {
        type: Number, // 초
        min: [0, "남은 시간은 음수일 수 없습니다"]
      },
      updatedAt: {
        type: Date,
        default: Date.now
      }
    },

    // ✅ 완료 정보
    wasCompleted: {
      type: Boolean,
      default: false,
      index: true
    },
    completionRate: {
      type: Number, // 0-100
      min: [0, "완료율은 0% 이상이어야 합니다"],
      max: [100, "완료율은 100%를 초과할 수 없습니다"],
      default: 0
    },
    actualDuration: {
      type: Number, // 실제 진행된 시간 (분)
      min: [0, "실제 지속시간은 음수일 수 없습니다"],
      default: 0
    },

    // 🏷️ 추가 정보
    cycleNumber: {
      type: Number,
      default: 1,
      min: [1, "사이클 번호는 1 이상이어야 합니다"]
    },
    tags: [
      {
        type: String,
        trim: true,
        maxlength: [20, "태그는 20자를 초과할 수 없습니다"]
      }
    ],
    note: {
      type: String,
      trim: true,
      maxlength: [500, "메모는 500자를 초과할 수 없습니다"]
    },

    // 🔧 시스템 필드
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },

    // 🔄 실시간 업데이트 지원
    liveUpdateEnabled: {
      type: Boolean,
      default: false
    },
    lastLiveUpdateAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true, // createdAt, updatedAt 자동 생성
    versionKey: false,

    // 🔍 쿼리 최적화
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        // 민감한 정보 제거
        delete ret.__v;
        return ret;
      }
    },
    toObject: { virtuals: true }
  }
);

// ===== 📊 인덱스 최적화 =====

// 복합 인덱스 (성능 최적화)
timerSchema.index({ userId: 1, startedAt: -1 }); // 사용자별 최신순
timerSchema.index({ userId: 1, status: 1 }); // 사용자별 상태 조회
timerSchema.index({ status: 1, startedAt: -1 }); // 전체 상태별 조회
timerSchema.index({ userId: 1, type: 1, createdAt: -1 }); // 타입별 조회
timerSchema.index({ wasCompleted: 1, completedAt: -1 }); // 완료된 세션 조회
timerSchema.index({ isActive: 1, updatedAt: -1 }); // 활성 세션 정리용

// TTL 인덱스 (자동 정리) - 비활성 세션 30일 후 삭제
timerSchema.index(
  { updatedAt: 1 },
  {
    expireAfterSeconds: 30 * 24 * 60 * 60, // 30일
    partialFilterExpression: { isActive: false }
  }
);

// ===== 💻 Virtual 필드들 =====

/**
 * 📊 전체 지속시간 (밀리초)
 */
timerSchema.virtual("totalDurationMs").get(function () {
  if (!this.startedAt) return 0;

  const endTime = this.completedAt || this.stoppedAt || new Date();
  return Math.max(
    0,
    endTime.getTime() - this.startedAt.getTime() - this.totalPausedDuration
  );
});

/**
 * 📊 전체 지속시간 (분)
 */
timerSchema.virtual("totalDurationMinutes").get(function () {
  return Math.round((this.totalDurationMs / (1000 * 60)) * 10) / 10; // 소수점 1자리
});

/**
 * 📈 진행률 (자동 계산)
 */
timerSchema.virtual("progressPercentage").get(function () {
  if (!this.lastProgress || !this.duration) return 0;

  const totalSeconds = this.duration * 60;
  const elapsed = totalSeconds - this.lastProgress.remainingTime;
  return Math.min(100, Math.max(0, Math.round((elapsed / totalSeconds) * 100)));
});

/**
 * 🏷️ 상태 표시명
 */
timerSchema.virtual("statusDisplay").get(function () {
  const statusMap = {
    active: "실행중",
    paused: "일시정지",
    completed: "완료",
    stopped: "중지"
  };
  return statusMap[this.status] || "알 수 없음";
});

/**
 * 🏷️ 타입 표시명
 */
timerSchema.virtual("typeDisplay").get(function () {
  const TimeHelper = require("../../utils/TimeHelper");
  return TimeHelper.getTimerTypeDisplay(this.type, true);
});

/**
 * ⏰ 시작 시간 표시
 */
timerSchema.virtual("startedAtDisplay").get(function () {
  return TimeHelper.safeDisplayTime(this.startedAt);
});

/**
 * ✅ 완료 시간 표시
 */
timerSchema.virtual("completedAtDisplay").get(function () {
  return TimeHelper.safeDisplayTime(this.completedAt);
});

// ===== 🎯 인스턴스 메서드들 =====

/**
 * ✅ 세션 완료 처리
 */
timerSchema.methods.complete = async function () {
  if (this.status === "completed") {
    throw new Error("이미 완료된 세션입니다.");
  }

  const now = new Date();

  // 일시정지 중이었다면 총 일시정지 시간 계산
  if (this.status === "paused" && this.pausedAt) {
    this.totalPausedDuration += now.getTime() - this.pausedAt.getTime();
  }

  this.status = "completed";
  this.completedAt = now;
  this.wasCompleted = true;

  // 완료율 계산
  this.completionRate = 100;
  this.actualDuration = this.totalDurationMinutes;

  // 진행률 최종 업데이트
  this.lastProgress = {
    remainingTime: 0,
    updatedAt: now
  };

  const saved = await this.save();
  logger.info(
    `✅ 타이머 완료: ${this.userId} - ${this.type} (${this.duration}분)`
  );

  return saved;
};

/**
 * ⏸️ 세션 일시정지
 */
timerSchema.methods.pause = async function () {
  if (this.status !== "active") {
    throw new Error("실행 중인 세션만 일시정지할 수 있습니다.");
  }

  this.status = "paused";
  this.pausedAt = new Date();

  const saved = await this.save();
  logger.info(`⏸️ 타이머 일시정지: ${this.userId} - ${this._id}`);

  return saved;
};

/**
 * ▶️ 세션 재개
 */
timerSchema.methods.resume = async function () {
  if (this.status !== "paused") {
    throw new Error("일시정지된 세션만 재개할 수 있습니다.");
  }

  const now = new Date();

  // 일시정지 시간 누적
  if (this.pausedAt) {
    const pausedDuration = now.getTime() - this.pausedAt.getTime();
    this.totalPausedDuration += pausedDuration;
  }

  this.status = "active";
  this.resumedAt = now;
  this.pausedAt = null;

  const saved = await this.save();
  logger.info(`▶️ 타이머 재개: ${this.userId} - ${this._id}`);

  return saved;
};

/**
 * ⏹️ 세션 중지
 */
timerSchema.methods.stop = async function () {
  if (this.status === "stopped" || this.status === "completed") {
    throw new Error("이미 종료된 세션입니다.");
  }

  const now = new Date();

  // 일시정지 중이었다면 총 일시정지 시간 계산
  if (this.status === "paused" && this.pausedAt) {
    this.totalPausedDuration += now.getTime() - this.pausedAt.getTime();
  }

  this.status = "stopped";
  this.stoppedAt = now;
  this.pausedAt = null;

  // 완료율 계산 (중간에 중지된 경우)
  const totalTime = this.duration * 60; // 초로 변환
  const remainingTime = this.lastProgress?.remainingTime || totalTime;
  const elapsedTime = totalTime - remainingTime;
  this.completionRate = Math.min(
    100,
    Math.max(0, Math.round((elapsedTime / totalTime) * 100))
  );
  this.actualDuration = this.totalDurationMinutes;

  const saved = await this.save();
  logger.info(
    `⏹️ 타이머 중지: ${this.userId} - ${this._id} (완료율: ${this.completionRate}%)`
  );

  return saved;
};

/**
 * 📊 진행률 업데이트
 */
timerSchema.methods.updateProgress = async function (remainingTime) {
  if (this.status !== "active") {
    throw new Error("실행 중인 세션만 진행률을 업데이트할 수 있습니다.");
  }

  this.lastProgress = {
    remainingTime: Math.max(0, parseInt(remainingTime)),
    updatedAt: new Date()
  };

  // 실시간 업데이트 시간 갱신
  if (this.liveUpdateEnabled) {
    this.lastLiveUpdateAt = new Date();
  }

  return await this.save();
};

/**
 * 🔄 실시간 업데이트 토글
 */
timerSchema.methods.toggleLiveUpdate = async function () {
  this.liveUpdateEnabled = !this.liveUpdateEnabled;
  this.lastLiveUpdateAt = this.liveUpdateEnabled ? new Date() : null;

  return await this.save();
};

/**
 * 🗑️ 소프트 삭제
 */
timerSchema.methods.softDelete = async function () {
  this.isActive = false;
  return await this.save();
};

// ===== 📊 정적 메서드들 =====

/**
 * 🔍 활성 세션 조회
 */
timerSchema.statics.findActiveSessions = function (userId = null) {
  const query = {
    status: { $in: ["active", "paused"] },
    isActive: true
  };

  if (userId) {
    query.userId = userId.toString();
  }

  return this.find(query).sort({ startedAt: -1 });
};

/**
 * 📊 오늘 완료된 세션 수
 */
timerSchema.statics.countTodayCompleted = async function (userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return this.countDocuments({
    userId: userId.toString(),
    status: "completed",
    completedAt: { $gte: today, $lt: tomorrow },
    isActive: true
  });
};

/**
 * 📈 사용자 세션 조회 (옵션 포함)
 */
timerSchema.statics.findByUser = function (userId, options = {}) {
  const query = this.find({
    userId: userId.toString(),
    isActive: true
  });

  // 상태 필터
  if (options.status) {
    if (Array.isArray(options.status)) {
      query.where("status").in(options.status);
    } else {
      query.where("status", options.status);
    }
  }

  // 타입 필터
  if (options.type) {
    if (Array.isArray(options.type)) {
      query.where("type").in(options.type);
    } else {
      query.where("type", options.type);
    }
  }

  // 날짜 범위 필터
  if (options.startDate || options.endDate) {
    const dateFilter = {};
    if (options.startDate) dateFilter.$gte = new Date(options.startDate);
    if (options.endDate) dateFilter.$lte = new Date(options.endDate);
    query.where("startedAt", dateFilter);
  }

  // 완료 여부 필터
  if (typeof options.wasCompleted === "boolean") {
    query.where("wasCompleted", options.wasCompleted);
  }

  // 정렬
  const sortOptions = options.sort || { startedAt: -1 };
  query.sort(sortOptions);

  // 페이징
  if (options.skip) query.skip(options.skip);
  if (options.limit) query.limit(options.limit);

  return query;
};

/**
 * 🏆 사용자 최고 기록 조회
 */
timerSchema.statics.getUserBestRecords = async function (userId) {
  const pipeline = [
    {
      $match: {
        userId: userId.toString(),
        status: "completed",
        isActive: true
      }
    },
    {
      $group: {
        _id: "$type",
        totalCompleted: { $sum: 1 },
        totalMinutes: { $sum: "$actualDuration" },
        longestSession: { $max: "$actualDuration" },
        averageDuration: { $avg: "$actualDuration" },
        bestCompletionRate: { $max: "$completionRate" }
      }
    }
  ];

  return this.aggregate(pipeline);
};

/**
 * 📊 월별 통계 집계
 */
timerSchema.statics.getMonthlyStats = async function (userId, year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const pipeline = [
    {
      $match: {
        userId: userId.toString(),
        startedAt: { $gte: startDate, $lte: endDate },
        isActive: true
      }
    },
    {
      $group: {
        _id: {
          type: "$type",
          status: "$status"
        },
        count: { $sum: 1 },
        totalMinutes: { $sum: "$actualDuration" },
        avgCompletionRate: { $avg: "$completionRate" }
      }
    },
    {
      $group: {
        _id: null,
        stats: {
          $push: {
            type: "$_id.type",
            status: "$_id.status",
            count: "$count",
            totalMinutes: "$totalMinutes",
            avgCompletionRate: "$avgCompletionRate"
          }
        },
        totalSessions: { $sum: "$count" },
        totalMinutes: { $sum: "$totalMinutes" }
      }
    }
  ];

  return this.aggregate(pipeline);
};

/**
 * 🧹 오래된 세션 정리
 */
timerSchema.statics.cleanupOldSessions = async function (daysOld = 90) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

  const result = await this.updateMany(
    {
      isActive: true,
      status: { $in: ["stopped", "completed"] },
      updatedAt: { $lt: cutoffDate }
    },
    {
      $set: { isActive: false }
    }
  );

  logger.info(
    `🧹 ${result.modifiedCount}개의 오래된 타이머 세션을 정리했습니다.`
  );
  return result;
};

// ===== 🔧 미들웨어 =====

/**
 * 💾 저장 전 유효성 검사
 */
timerSchema.pre("save", function (next) {
  // 완료율 자동 계산 (lastProgress가 있는 경우)
  if (this.lastProgress && this.duration && !this.completionRate) {
    const totalSeconds = this.duration * 60;
    const elapsed = totalSeconds - this.lastProgress.remainingTime;
    this.completionRate = Math.min(
      100,
      Math.max(0, Math.round((elapsed / totalSeconds) * 100))
    );
  }

  // 실제 지속시간 자동 계산
  if (!this.actualDuration && this.totalDurationMinutes) {
    this.actualDuration = this.totalDurationMinutes;
  }

  next();
});

/**
 * 🗑️ 삭제 전 관련 데이터 정리
 */
timerSchema.pre(
  "deleteOne",
  { document: true, query: false },
  async function () {
    logger.info(`🗑️ 타이머 세션 삭제: ${this._id}`);
    // 필요시 관련 통계 데이터 정리 로직 추가
  }
);

// ===== 📊 모델 생성 =====

const Timer = mongoose.model("Timer", timerSchema);

module.exports = Timer;
