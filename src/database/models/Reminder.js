// database/models/Reminder.js - 리마인더 데이터베이스 모델
const mongoose = require("mongoose");

/**
 * 🔔 Reminder Model - 리마인더 데이터 스키마
 *
 * ✅ 기능:
 * - 할일 연결 리마인드
 * - 독립적인 리마인드
 * - 반복 리마인드
 * - 스마트 알림
 */
const reminderSchema = new mongoose.Schema(
  {
    // 기본 정보
    userId: {
      type: String,
      required: true,
      index: true,
      trim: true
    },

    // 리마인드 내용
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000
    },

    // 🔗 할일 연결 (선택적)
    todoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Todo",
      default: null
    },

    // ⏰ 시간 설정
    reminderTime: {
      type: Date,
      required: true,
      index: true
    },

    // 타임존 (기본값: 한국 표준시)
    timezone: {
      type: String,
      default: "Asia/Seoul"
    },

    // 🔄 반복 설정
    isRecurring: {
      type: Boolean,
      default: false
    },

    recurringPattern: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly", "custom"],
      default: null
    },

    recurringInterval: {
      type: Number,
      min: 1,
      default: 1 // 1일마다, 1주마다 등
    },

    recurringEndDate: {
      type: Date,
      default: null
    },

    // 📱 알림 타입
    notificationType: {
      type: String,
      enum: ["simple", "urgent", "smart", "silent"],
      default: "simple"
    },

    // 🎯 우선순위
    priority: {
      type: Number,
      min: 1,
      max: 5,
      default: 3
    },

    // 📂 카테고리
    category: {
      type: String,
      trim: true,
      maxlength: 50,
      default: null
    },

    // 🏷️ 태그
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 20
      }
    ],

    // 📊 상태 관리
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },

    completed: {
      type: Boolean,
      default: false
    },

    // 🕐 실행 관련
    triggeredAt: {
      type: Date,
      default: null
    },

    completedAt: {
      type: Date,
      default: null
    },

    // 🔕 비활성화 관련
    deactivatedAt: {
      type: Date,
      default: null
    },

    deactivatedReason: {
      type: String,
      enum: ["user_request", "todo_completed", "expired", "error", "system"],
      default: null
    },

    // 📝 추가 설정
    customMessage: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null
    },

    sentAt: {
      type: Date,
      default: null
    },
    type: {
      type: String,
      default: "general"
    },
    retryCount: {
      type: Number,
      default: 0
    },
    lastError: {
      type: String,
      default: null
    },
    lastErrorAt: {
      type: Date,
      default: null
    },
    failedAt: {
      type: Date,
      default: null
    },
    failureReason: {
      type: String,
      default: null
    },

    // 🔔 스누즈 기능
    snoozeCount: {
      type: Number,
      default: 0,
      min: 0,
      max: 5 // 최대 5번까지 스누즈
    },

    lastSnoozeAt: {
      type: Date,
      default: null
    },

    // 📊 메타데이터
    metadata: {
      // 생성 방식 (manual, smart, template)
      creationMethod: {
        type: String,
        enum: ["manual", "smart", "template", "recurring"],
        default: "manual"
      },

      // 원본 리마인드 ID (반복 리마인드의 경우)
      parentReminderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Reminder",
        default: null
      },

      // 사용자 입력 원본 텍스트
      originalInput: {
        type: String,
        default: null
      },

      // 파싱된 시간 정보
      parsedTimeInfo: {
        type: mongoose.Schema.Types.Mixed,
        default: null
      }
    },

    // 📈 통계 정보
    stats: {
      viewCount: {
        type: Number,
        default: 0
      },

      editCount: {
        type: Number,
        default: 0
      },

      snoozeHistory: [
        {
          snoozeAt: Date,
          snoozeDuration: Number, // 분 단위
          reason: String
        }
      ]
    }
  },
  {
    timestamps: true, // createdAt, updatedAt 자동 생성
    versionKey: false
  }
);

// ===== 인덱스 설정 =====

// 복합 인덱스: 사용자별 활성 리마인드 조회
reminderSchema.index({ userId: 1, isActive: 1, reminderTime: 1 });

// 복합 인덱스: 실행 대기 중인 리마인드 조회
reminderSchema.index({
  isActive: 1,
  reminderTime: 1,
  completed: 1
});

// 할일 연결 리마인드 조회
reminderSchema.index({ todoId: 1, isActive: 1 });

// 반복 리마인드 조회
reminderSchema.index({ isRecurring: 1, isActive: 1 });

// ===== 가상 필드 =====

// 리마인드까지 남은 시간 (분 단위)
reminderSchema.virtual("minutesUntilReminder").get(function () {
  if (!this.reminderTime) return null;
  const now = new Date();
  const diff = this.reminderTime.getTime() - now.getTime();
  return Math.max(0, Math.round(diff / (1000 * 60)));
});

// 읽기 쉬운 시간 표시
reminderSchema.virtual("readableTime").get(function () {
  if (!this.reminderTime) return null;

  return new Date(this.reminderTime).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
});

// 리마인드 상태
reminderSchema.virtual("status").get(function () {
  if (!this.isActive) return "inactive";
  if (this.completed) return "completed";
  if (this.reminderTime < new Date()) return "overdue";
  return "pending";
});

// ===== 인스턴스 메서드 =====

/**
 * 🔔 리마인드 실행
 */
reminderSchema.methods.trigger = function () {
  this.triggeredAt = new Date();
  this.stats.viewCount += 1;

  // 반복 리마인드가 아니면 완료 처리
  if (!this.isRecurring) {
    this.completed = true;
    this.completedAt = new Date();
  }

  return this.save();
};

/**
 * ⏰ 스누즈 처리
 */
reminderSchema.methods.snooze = function (minutes = 10) {
  if (this.snoozeCount >= 5) {
    throw new Error("최대 스누즈 횟수를 초과했습니다.");
  }

  const newReminderTime = new Date(
    this.reminderTime.getTime() + minutes * 60 * 1000
  );

  this.reminderTime = newReminderTime;
  this.snoozeCount += 1;
  this.lastSnoozeAt = new Date();

  // 스누즈 히스토리 추가
  this.stats.snoozeHistory.push({
    snoozeAt: new Date(),
    snoozeDuration: minutes,
    reason: "user_request"
  });

  return this.save();
};

/**
 * 🔕 리마인드 비활성화
 */
reminderSchema.methods.deactivate = function (reason = "user_request") {
  this.isActive = false;
  this.deactivatedAt = new Date();
  this.deactivatedReason = reason;

  return this.save();
};

/**
 * 🔄 다음 반복 리마인드 생성
 */
reminderSchema.methods.createNextRecurrence = function () {
  if (!this.isRecurring) {
    throw new Error("반복 리마인드가 아닙니다.");
  }

  let nextTime = new Date(this.reminderTime);

  switch (this.recurringPattern) {
    case "daily":
      nextTime.setDate(nextTime.getDate() + this.recurringInterval);
      break;
    case "weekly":
      nextTime.setDate(nextTime.getDate() + 7 * this.recurringInterval);
      break;
    case "monthly":
      nextTime.setMonth(nextTime.getMonth() + this.recurringInterval);
      break;
    case "yearly":
      nextTime.setFullYear(nextTime.getFullYear() + this.recurringInterval);
      break;
    default:
      throw new Error("지원하지 않는 반복 패턴입니다.");
  }

  // 종료 날짜 체크
  if (this.recurringEndDate && nextTime > this.recurringEndDate) {
    return null;
  }

  // 새 리마인드 생성
  const Reminder = this.constructor;
  const nextReminder = new Reminder({
    userId: this.userId,
    text: this.text,
    description: this.description,
    todoId: this.todoId,
    reminderTime: nextTime,
    timezone: this.timezone,
    isRecurring: true,
    recurringPattern: this.recurringPattern,
    recurringInterval: this.recurringInterval,
    recurringEndDate: this.recurringEndDate,
    notificationType: this.notificationType,
    priority: this.priority,
    category: this.category,
    tags: [...this.tags],
    metadata: {
      ...this.metadata,
      parentReminderId: this.metadata.parentReminderId || this._id,
      creationMethod: "recurring"
    }
  });

  return nextReminder.save();
};

// ===== 정적 메서드 =====

/**
 * 🔍 실행 대기 중인 리마인드 조회
 */
reminderSchema.statics.findPendingReminders = function () {
  return this.find({
    isActive: true,
    completed: false,
    reminderTime: { $lte: new Date() }
  }).sort({ priority: -1, reminderTime: 1 });
};

/**
 * 📊 사용자 리마인드 통계
 */
reminderSchema.statics.getUserStats = function (userId) {
  return this.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: ["$isActive", 1, 0] } },
        completed: { $sum: { $cond: ["$completed", 1, 0] } },
        overdue: {
          $sum: {
            $cond: [
              {
                $and: [
                  "$isActive",
                  { $not: "$completed" },
                  { $lt: ["$reminderTime", new Date()] }
                ]
              },
              1,
              0
            ]
          }
        }
      }
    }
  ]);
};

// ===== 미들웨어 =====

// 저장 전 유효성 검증
reminderSchema.pre("save", function (next) {
  // 과거 시간 체크 (새 리마인드만)
  if (this.isNew && this.reminderTime <= new Date()) {
    return next(new Error("리마인드 시간은 미래여야 합니다."));
  }

  // 반복 리마인드 유효성 체크
  if (this.isRecurring && !this.recurringPattern) {
    return next(new Error("반복 리마인드는 반복 패턴이 필요합니다."));
  }

  // 태그 개수 제한
  if (this.tags && this.tags.length > 5) {
    this.tags = this.tags.slice(0, 5);
  }

  next();
});

// 삭제 시 관련 데이터 정리
reminderSchema.pre(
  "deleteOne",
  { document: true, query: false },
  async function (next) {
    try {
      // 자식 반복 리마인드들도 함께 삭제
      if (this.isRecurring) {
        await this.constructor.deleteMany({
          "metadata.parentReminderId": this._id
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  }
);

// ===== JSON 출력 설정 =====
reminderSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    // 민감한 정보 제거
    delete ret.__v;
    delete ret.stats.snoozeHistory;

    // ID 형태 통일
    ret.id = ret._id;
    delete ret._id;

    return ret;
  }
});

// 모델 생성 및 내보내기
const Reminder = mongoose.model("Reminder", reminderSchema);

module.exports = Reminder;
