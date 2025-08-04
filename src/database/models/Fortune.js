// src/database/models/Fortune.js - 타로 운세 데이터 모델

const mongoose = require("mongoose");

/**
 * 🎴 카드 정보 스키마
 */
const CardSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    korean: {
      type: String,
      required: true
    },
    arcana: {
      type: String,
      enum: ["major", "minor"],
      required: true
    },
    suit: {
      type: String,
      enum: ["wands", "cups", "swords", "pentacles", null]
    },
    number: Number,
    court: {
      type: String,
      enum: ["page", "knight", "queen", "king", null]
    },
    isReversed: {
      type: Boolean,
      default: false
    },
    position: String, // 포지션 (triple, celtic에서 사용)
    positionName: String, // 포지션 이름
    positionDescription: String // 포지션 설명
  },
  { _id: false }
);

/**
 * 🔮 해석 정보 스키마
 */
const InterpretationSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      default: "general"
    },
    type: {
      type: String,
      required: true
    },
    cards: [
      {
        type: mongoose.Schema.Types.Mixed
      }
    ],
    overall: String,
    advice: String,
    specialPatterns: [
      {
        type: {
          type: String
        },
        message: String
      }
    ],
    analysis: {
      majorCount: Number,
      reversedCount: Number,
      suits: {
        type: Map,
        of: Number
      },
      elements: {
        type: Map,
        of: Number
      }
    }
  },
  { _id: false }
);

/**
 * 📋 뽑기 기록 스키마
 */
const DrawRecordSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["single", "triple", "celtic"],
    required: true
  },
  question: {
    type: String,
    default: null,
    maxLength: 500
  },
  cards: [CardSchema],
  interpretation: InterpretationSchema,
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  isSpecialTime: {
    type: Boolean,
    default: false
  }
});

/**
 * 📊 통계 스키마
 */
const StatsSchema = new mongoose.Schema(
  {
    totalDraws: {
      type: Number,
      default: 0
    },
    typeCount: {
      single: { type: Number, default: 0 },
      triple: { type: Number, default: 0 },
      celtic: { type: Number, default: 0 }
    },
    cardFrequency: {
      type: Map,
      of: Number,
      default: new Map()
    },
    favoriteCard: {
      id: Number,
      name: String,
      korean: String,
      count: Number
    },
    lastWeekDraws: {
      type: Number,
      default: 0
    },
    longestStreak: {
      type: Number,
      default: 0
    },
    currentStreak: {
      type: Number,
      default: 0
    },
    lastStreakDate: Date
  },
  { _id: false }
);

/**
 * 🏆 업적 스키마
 */
const AchievementSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    description: String,
    unlockedAt: {
      type: Date,
      default: Date.now
    },
    data: mongoose.Schema.Types.Mixed
  },
  { _id: false }
);

/**
 * 👤 FortuneUser 메인 스키마
 */
const FortuneUserSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    userName: {
      type: String,
      default: "사용자"
    },

    // 뽑기 기록
    draws: {
      type: [DrawRecordSchema],
      default: []
    },

    // 통계
    stats: {
      type: StatsSchema,
      default: () => ({})
    },

    // 설정
    settings: {
      notifications: {
        type: Boolean,
        default: true
      },
      preferredTime: {
        type: String,
        default: null
      },
      language: {
        type: String,
        default: "ko"
      }
    },

    // 업적
    achievements: {
      type: [AchievementSchema],
      default: []
    },

    // 특별 이벤트
    specialEvents: [
      {
        type: {
          type: String
        },
        date: Date,
        data: mongoose.Schema.Types.Mixed
      }
    ],

    // 메타 정보
    firstDrawAt: {
      type: Date,
      default: null
    },

    lastDrawAt: {
      type: Date,
      default: null,
      index: true
    },

    createdAt: {
      type: Date,
      default: Date.now
    },

    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    collection: "fortune_users"
  }
);

/**
 * 🔧 인덱스 설정
 */
FortuneUserSchema.index({ userId: 1, "draws.timestamp": -1 });
FortuneUserSchema.index({ "stats.totalDraws": -1 });
FortuneUserSchema.index({ lastDrawAt: -1 });
FortuneUserSchema.index({ "draws.type": 1 });

/**
 * 🛠️ 인스턴스 메서드
 */

// 오늘 뽑은 횟수 계산
FortuneUserSchema.methods.getTodayDrawCount = function () {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return this.draws.filter((draw) => new Date(draw.timestamp) >= today).length;
};

// 특정 카드 뽑은 횟수
FortuneUserSchema.methods.getCardDrawCount = function (cardId) {
  let count = 0;
  this.draws.forEach((draw) => {
    draw.cards.forEach((card) => {
      if (card.id === cardId) count++;
    });
  });
  return count;
};

// 가장 많이 나온 카드 찾기
FortuneUserSchema.methods.findFavoriteCard = function () {
  const cardCounts = new Map();

  this.draws.forEach((draw) => {
    draw.cards.forEach((card) => {
      const key = `${card.id}_${card.name}`;
      const current = cardCounts.get(key) || {
        card: { id: card.id, name: card.name, korean: card.korean },
        count: 0
      };
      current.count++;
      cardCounts.set(key, current);
    });
  });

  let favorite = null;
  let maxCount = 0;

  cardCounts.forEach((data) => {
    if (data.count > maxCount) {
      maxCount = data.count;
      favorite = data.card;
    }
  });

  return favorite ? { ...favorite, count: maxCount } : null;
};

// 연속 뽑기 일수 계산
FortuneUserSchema.methods.calculateStreak = function () {
  if (this.draws.length === 0) return { current: 0, longest: 0 };

  // 날짜별로 정렬
  const dates = this.draws
    .map((draw) => {
      const date = new Date(draw.timestamp);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    })
    .filter((date, index, self) => self.indexOf(date) === index)
    .sort((a, b) => b - a);

  let currentStreak = 1;
  let longestStreak = 1;

  // 오늘 뽑았는지 확인
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (dates[0] !== today.getTime()) {
    currentStreak = 0;
  }

  // 연속 일수 계산
  for (let i = 1; i < dates.length; i++) {
    const diff = dates[i - 1] - dates[i];
    const daysDiff = diff / (1000 * 60 * 60 * 24);

    if (daysDiff === 1) {
      if (currentStreak > 0) currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      if (currentStreak > 0) {
        longestStreak = Math.max(longestStreak, currentStreak);
        currentStreak = 0;
      }
    }
  }

  return { current: currentStreak, longest: longestStreak };
};

/**
 * 🔧 정적 메서드
 */

// 일일 활성 사용자 수
FortuneUserSchema.statics.getDailyActiveUsers = async function (
  date = new Date()
) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return this.countDocuments({
    "draws.timestamp": {
      $gte: startOfDay,
      $lte: endOfDay
    }
  });
};

// 인기 카드 통계
FortuneUserSchema.statics.getPopularCards = async function (limit = 10) {
  const result = await this.aggregate([
    { $unwind: "$draws" },
    { $unwind: "$draws.cards" },
    {
      $group: {
        _id: {
          id: "$draws.cards.id",
          name: "$draws.cards.name",
          korean: "$draws.cards.korean"
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);

  return result.map((item) => ({
    card: item._id,
    count: item.count
  }));
};

/**
 * 🔧 미들웨어
 */
 
// 업데이트 시간 자동 갱신
FortuneUserSchema.pre("findOneAndUpdate", function () {
  this.set({ updatedAt: new Date() });
});

/**
 * 🏷️ 모델 생성 및 내보내기
 */
const FortuneUser = mongoose.model("FortuneUser", FortuneUserSchema);

module.exports = {
  FortuneUser,
  FortuneUserSchema,
  CardSchema,
  InterpretationSchema,
  DrawRecordSchema
};
