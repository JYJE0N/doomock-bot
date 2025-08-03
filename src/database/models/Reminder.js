// src/database/models/Reminder.js - 🔔 리마인더 Mongoose 모델
const mongoose = require("mongoose");
const logger = require("../../utils/Logger");

/**
 * 🔔 Reminder Mongoose 스키마 - 스케줄링 최적화
 *
 * 🎯 핵심 필드:
 * - text: 리마인더 메시지
 * - reminderTime: 알림 시간
 * - type: 리마인더 타입 (todo_reminder, general 등)
 * - todoId: 연결된 할일 ID (옵션)
 *
 * ✅ 특징:
 * - 스케줄링 최적화 인덱스
 * - 재시도 로직 지원
 * - 스누즈 기능
 * - 통계 집계 지원
 */

const reminderSchema = new mongoose.Schema(
  {
    // 👤 사용자 정보
    // userId: {
    //   type: String,
    //   required: [true, "사용자 ID는 필수입니다"],
    //   // index: true,
    // },

    // 📝 리마인더 내용
    text: {
      type: String,
      required: [true, "리마인더 내용을 입력해주세요"],
      trim: true,
      maxlength: [500, "리마인더는 500자를 초과할 수 없습니다"]
    },

    // ⏰ 알림 시간 (핵심!)
    reminderTime: {
      type: Date,
      required: [true, "알림 시간은 필수입니다"],
      index: true,
      validate: {
        validator: function (value) {
          return value > new Date(); // 미래 시간만 허용
        },
        message: "알림 시간은 현재 시간보다 미래여야 합니다"
      }
    },

    // 🏷️ 리마인더 타입
    type: {
      type: String,
      required: true,
      enum: {
        values: ["general", "todo_reminder", "meeting", "deadline", "habit"],
        message: "지원하지 않는 리마인더 타입입니다"
      },
      default: "general",
      index: true
    },

    // 🔗 연결된 할일 ID (할일 리마인더인 경우)
    todoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Todo",
      index: { sparse: true }
    },

    // 📊 상태 필드들
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },

    isSent: {
      type: Boolean,
      default: false,
      index: true
    },

    sentAt: {
      type: Date
    },

    // 🔄 재시도 관련
    retryCount: {
      type: Number,
      default: 0,
      min: 0
    },

    maxRetries: {
      type: Number,
      default: 3,
      min: 0,
      max: 10
    },

    nextRetryTime: {
      type: Date,
      index: { sparse: true }
    },

    lastError: {
      type: String,
      maxlength: 1000
    },

    // ❌ 실패 처리
    isFailed: {
      type: Boolean,
      default: false,
      index: true
    },

    failedAt: {
      type: Date
    },

    failureReason: {
      type: String,
      maxlength: 500
    },

    // ⏰ 스누즈 기능
    snoozedAt: {
      type: Date
    },

    snoozeCount: {
      type: Number,
      default: 0,
      min: 0
    },

    // 🔕 비활성화
    disabledAt: {
      type: Date
    },

    deletedAt: {
      type: Date
    },

    // 🔄 반복 설정 (향후 확장용)
    isRecurring: {
      type: Boolean,
      default: false
    },

    recurringPattern: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly"],
      required: function () {
        return this.isRecurring;
      }
    },

    // 📊 버전 관리
    version: {
      type: Number,
      default: 1
    }
  },
  {
    // Mongoose 옵션
    timestamps: true, // createdAt, updatedAt 자동 생성
    versionKey: false,

    // 컬렉션 옵션
    collection: "reminders"
  }
);

// ===== 🔍 인덱스 설정 (스케줄링 최적화) =====

// 스케줄링 핵심 인덱스 (가장 중요!)
reminderSchema.index(
  {
    isActive: 1,
    isSent: 1,
    reminderTime: 1
  },
  {
    name: "scheduling_core_index",
    background: true
  }
);

// 재시도 처리용 인덱스
reminderSchema.index(
  {
    isActive: 1,
    isSent: 1,
    retryCount: 1,
    nextRetryTime: 1
  },
  {
    name: "retry_processing_index",
    background: true
  }
);

// 사용자별 조회 인덱스
reminderSchema.index(
  {
    userId: 1,
    isActive: 1,
    reminderTime: 1
  },
  {
    name: "user_reminders_index",
    background: true
  }
);

// 타입별 조회 인덱스
reminderSchema.index(
  {
    userId: 1,
    type: 1,
    isActive: 1
  },
  {
    name: "user_type_index",
    background: true
  }
);

// 할일 연동 인덱스
reminderSchema.index(
  {
    todoId: 1,
    isActive: 1
  },
  {
    sparse: true,
    name: "todo_link_index",
    background: true
  }
);

// 정리 작업용 인덱스
reminderSchema.index(
  {
    isSent: 1,
    sentAt: 1
  },
  {
    name: "cleanup_sent_index",
    background: true
  }
);

reminderSchema.index(
  {
    isFailed: 1,
    failedAt: 1
  },
  {
    name: "cleanup_failed_index",
    background: true
  }
);

// ===== ✨ 가상 속성 (Virtual Properties) =====

/**
 * 리마인더 상태 확인
 */
reminderSchema.virtual("status").get(function () {
  if (!this.isActive) return "inactive";
  if (this.isFailed) return "failed";
  if (this.isSent) return "sent";

  const now = new Date();
  if (this.reminderTime <= now) return "overdue";

  return "pending";
});

/**
 * 알림까지 남은 시간 (분 단위)
 */
reminderSchema.virtual("minutesUntilReminder").get(function () {
  if (this.isSent || !this.isActive) return null;

  const now = new Date();
  const diff = this.reminderTime - now;
  return Math.ceil(diff / (1000 * 60));
});

/**
 * 사용자 친화적 시간 표시
 */
reminderSchema.virtual("friendlyTime").get(function () {
  const minutes = this.minutesUntilReminder;

  if (minutes === null) return null;
  if (minutes <= 0) return "지금";
  if (minutes < 60) return `${minutes}분 후`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 후`;

  const days = Math.floor(hours / 24);
  return `${days}일 후`;
});

/**
 * 재시도 가능 여부
 */
reminderSchema.virtual("canRetry").get(function () {
  return this.isActive && !this.isSent && !this.isFailed && this.retryCount < this.maxRetries;
});

// ===== 🔧 미들웨어 (Middleware) =====

/**
 * 저장 전 처리
 */
reminderSchema.pre("save", function (next) {
  // 버전 증가 (수정된 경우)
  if (this.isModified() && !this.isNew) {
    this.version += 1;
  }

  // 발송 완료 시 sentAt 자동 설정
  if (this.isModified("isSent") && this.isSent && !this.sentAt) {
    this.sentAt = new Date();
  }

  // 실패 처리 시 failedAt 자동 설정
  if (this.isModified("isFailed") && this.isFailed && !this.failedAt) {
    this.failedAt = new Date();
  }

  // 비활성화 시 disabledAt 자동 설정
  if (this.isModified("isActive") && !this.isActive && !this.disabledAt) {
    this.disabledAt = new Date();
  }

  next();
});

/**
 * 업데이트 전 처리
 */
reminderSchema.pre(["updateOne", "findOneAndUpdate"], function (next) {
  this.set({
    updatedAt: new Date(),
    $inc: { version: 1 }
  });

  next();
});

// ===== 🛠️ 인스턴스 메서드 (Instance Methods) =====

/**
 * 리마인더 발송 완료 처리
 */
reminderSchema.methods.markAsSent = async function () {
  this.isSent = true;
  this.sentAt = new Date();
  return await this.save();
};

/**
 * 리마인더 실패 처리
 */
reminderSchema.methods.markAsFailed = async function (reason) {
  this.isFailed = true;
  this.failedAt = new Date();
  this.failureReason = reason;
  this.isActive = false;
  return await this.save();
};

/**
 * 스누즈 (N분 후 다시 알림)
 */
reminderSchema.methods.snooze = async function (minutes = 30) {
  const newTime = new Date(Date.now() + minutes * 60 * 1000);

  this.reminderTime = newTime;
  this.isSent = false;
  this.retryCount = 0;
  this.snoozedAt = new Date();
  this.snoozeCount += 1;

  return await this.save();
};

/**
 * 리마인더 비활성화
 */
reminderSchema.methods.disable = async function () {
  this.isActive = false;
  this.disabledAt = new Date();
  return await this.save();
};

/**
 * 소프트 삭제
 */
reminderSchema.methods.softDelete = async function () {
  this.isActive = false;
  this.deletedAt = new Date();
  return await this.save();
};

// ===== 📊 정적 메서드 (Static Methods) =====

/**
 * 사용자의 활성 리마인더 조회
 */
reminderSchema.statics.findActiveByUser = function (userId, options = {}) {
  const query = this.find({
    userId: String(userId),
    isActive: true
  });

  if (options.type) {
    query.where("type", options.type);
  }

  if (options.pending) {
    query.where("isSent", false);
    query.where("reminderTime").gt(new Date());
  }

  return query.sort(options.sort || { reminderTime: 1 }).limit(options.limit || 0);
};

/**
 * 발송 대상 리마인더 조회 (스케줄러용)
 */
reminderSchema.statics.findPendingReminders = function (currentTime, limit = 10) {
  return this.find({
    isActive: true,
    isSent: false,
    isFailed: false,
    reminderTime: { $lte: currentTime },

    // 재시도 로직
    $or: [
      { retryCount: { $lte: 0 } }, // 첫 시도
      {
        retryCount: { $gt: 0 },
        nextRetryTime: { $lte: currentTime }
      }
    ]
  })
    .sort({ reminderTime: 1 })
    .limit(limit);
};

/**
 * 사용자 리마인더 통계
 */
reminderSchema.statics.getUserStats = async function (userId) {
  const now = new Date();

  return await this.aggregate([
    {
      $match: {
        userId: String(userId),
        isActive: true
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        pending: {
          $sum: {
            $cond: [
              {
                $and: [{ $gt: ["$reminderTime", now] }, { $eq: ["$isSent", false] }]
              },
              1,
              0
            ]
          }
        },
        sent: {
          $sum: { $cond: ["$isSent", 1, 0] }
        },
        overdue: {
          $sum: {
            $cond: [
              {
                $and: [{ $lte: ["$reminderTime", now] }, { $eq: ["$isSent", false] }, { $eq: ["$isFailed", false] }]
              },
              1,
              0
            ]
          }
        },
        failed: {
          $sum: { $cond: ["$isFailed", 1, 0] }
        }
      }
    }
  ]);
};

/**
 * 타입별 리마인더 통계
 */
reminderSchema.statics.getTypeStats = async function (userId) {
  return await this.aggregate([
    {
      $match: {
        userId: String(userId),
        isActive: true
      }
    },
    {
      $group: {
        _id: "$type",
        count: { $sum: 1 },
        sent: { $sum: { $cond: ["$isSent", 1, 0] } },
        pending: {
          $sum: {
            $cond: [
              {
                $and: [{ $eq: ["$isSent", false] }, { $gt: ["$reminderTime", new Date()] }]
              },
              1,
              0
            ]
          }
        }
      }
    },
    {
      $project: {
        type: "$_id",
        count: 1,
        sent: 1,
        pending: 1,
        _id: 0
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
};

// ===== 🎯 스키마 후킹 =====

/**
 * JSON 변환 시 가상 속성 포함
 */
reminderSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

/**
 * Object 변환 시 가상 속성 포함
 */
reminderSchema.set("toObject", { virtuals: true });

// ===== 📝 로깅 미들웨어 =====

/**
 * 저장 후 로깅
 */
reminderSchema.post("save", function (doc) {
  if (doc.isNew) {
    logger.debug(`🔔 새 리마인더 저장됨: ${doc._id} (${doc.reminderTime.toISOString()})`);
  } else if (doc.isSent) {
    logger.debug(`✅ 리마인더 발송 완료: ${doc._id}`);
  }
});

/**
 * 업데이트 후 로깅
 */
reminderSchema.post("findOneAndUpdate", function (doc) {
  if (doc && doc.isSent) {
    logger.debug(`✅ 리마인더 상태 업데이트: ${doc._id}`);
  }
});

// ===== 🏭 모델 생성 및 내보내기 =====

const Reminder = mongoose.model("Reminder", reminderSchema);

module.exports = Reminder;
