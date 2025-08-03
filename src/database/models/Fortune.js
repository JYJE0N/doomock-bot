// 🔧 Fortune.js - 78장 전체 덱을 지원하도록 스키마 수정

const mongoose = require("mongoose");

/**
 * 🔮 타로 운세 사용자 기록 스키마
 * 컬렉션명: fortune_records
 *
 * 🎯 기능:
 * - 완전한 78장 타로 덱 지원 (메이저 22장 + 마이너 56장)
 * - 사용자별 타로 뽑기 기록 관리
 * - 일일 제한 체크 (하루 3회)
 * - 뽑기 히스토리 저장
 * - 두목봇 캐릭터 멘트 포함
 */

// 개별 카드 뽑기 기록 서브스키마
const DrawHistorySchema = new mongoose.Schema(
  {
    date: {
      type: String, // YYYY-MM-DD 형태
      required: true
    },
    cardId: {
      type: Number,
      required: true,
      min: 0,
      // ✅ 수정: 78장 전체 덱 지원 (최대 155까지)
      // 메이저 아르카나: 0-21 (22장)
      // 마이너 아르카나: 100-155 (56장, 4슈트 × 14장)
      max: 155
    },
    cardName: {
      type: String, // "The Fool", "Ace of Cups" 등
      required: true,
      maxLength: 50
    },
    koreanName: {
      type: String, // "바보", "컵 에이스" 등
      required: true,
      maxLength: 30 // ✅ 수정: 마이너 아르카나 이름이 길어질 수 있음
    },
    isReversed: {
      type: Boolean, // 정방향(false) / 역방향(true)
      required: true,
      default: false
    },
    drawType: {
      type: String,
      required: true,
      // ✅ 수정: 캘틱 크로스 추가
      enum: ["single", "triple", "celtic"]
    },
    position: {
      type: String, // 3장: "past"|"present"|"future", 캘틱: "present"|"challenge" 등
      required: false,
      // ✅ 수정: 캘틱 크로스 포지션 추가
      enum: [
        // 트리플 카드 포지션
        "past",
        "present",
        "future",
        // 캘틱 크로스 포지션
        "challenge",
        "conscious",
        "unconscious",
        "approach",
        "environment",
        "hopes_fears",
        "outcome"
      ]
    },
    // ✅ 추가: 아르카나 타입
    arcana: {
      type: String,
      required: false,
      enum: ["major", "minor"],
      default: "major"
    },
    // ✅ 추가: 마이너 아르카나용 슈트 정보
    suit: {
      type: String,
      required: false,
      enum: ["Cups", "Wands", "Swords", "Pentacles"]
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now
    },
    // 두목봇 특별 멘트 저장
    doomockComment: {
      type: String,
      required: false,
      maxLength: 300 // ✅ 수정: 길이 증가 (캘틱 크로스용)
    },
    // ✅ 추가: 캘틱 크로스용 질문
    question: {
      type: String,
      required: false,
      maxLength: 200
    }
  },
  {
    _id: true // 서브도큐먼트도 ID 자동 생성
  }
);

// 메인 사용자 기록 스키마
const FortuneUserSchema = new mongoose.Schema(
  {
    // 🔑 사용자 식별
    userId: {
      type: Number,
      required: true,
      unique: true
    },
    userName: {
      type: String,
      required: false,
      maxLength: 50,
      trim: true
    },

    // 📊 통계 정보
    totalDraws: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    lastDrawDate: {
      type: String, // YYYY-MM-DD 형태 (일일 제한용)
      required: false,
      match: /^\d{4}-\d{2}-\d{2}$/
    },
    lastDrawTimestamp: {
      type: Date,
      required: false
    },
    // ✅ 수정: 하루 3번으로 제한 증가 (캘틱 크로스용)
    todayDrawCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 3 // 하루 최대 3번
    },

    // 📈 선호도 분석 (78장 덱용 확장)
    preferences: {
      favoriteCards: [
        {
          cardId: {
            type: Number,
            min: 0,
            max: 155 // ✅ 수정: 78장 덱 지원
          },
          cardName: String,
          koreanName: String,
          arcana: {
            type: String,
            enum: ["major", "minor"]
          },
          drawCount: {
            type: Number,
            default: 1
          }
        }
      ],
      mostReversed: {
        type: Boolean, // 역방향을 더 많이 뽑는지
        default: false
      },
      preferredDrawType: {
        type: String,
        enum: ["single", "triple", "celtic", "mixed"],
        default: "mixed"
      },
      // ✅ 추가: 선호 아르카나
      preferredArcana: {
        type: String,
        enum: ["major", "minor", "mixed"],
        default: "mixed"
      },
      // ✅ 추가: 선호 슈트 (마이너 아르카나용)
      favoriteSuit: {
        type: String,
        enum: ["Cups", "Wands", "Swords", "Pentacles", "mixed"],
        default: "mixed"
      }
    },

    // 📋 뽑기 히스토리
    drawHistory: [DrawHistorySchema],

    // 🌙 일일 제한 관련
    dailyStats: {
      currentStreak: {
        // 연속 사용 일수
        type: Number,
        default: 0,
        min: 0
      },
      longestStreak: {
        // 최장 연속 사용 일수
        type: Number,
        default: 0,
        min: 0
      },
      totalDaysUsed: {
        // 총 사용 일수
        type: Number,
        default: 0,
        min: 0
      },
      // ✅ 추가: 78장 덱 관련 통계
      majorArcanaDraws: {
        type: Number,
        default: 0,
        min: 0
      },
      minorArcanaDraws: {
        type: Number,
        default: 0,
        min: 0
      },
      celticCrossCount: {
        type: Number,
        default: 0,
        min: 0
      }
    },

    // ⏰ 타임스탬프 (자동 관리)
    createdAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      required: true,
      default: Date.now
    },

    // 🏷️ 메타데이터
    version: {
      type: Number,
      required: true,
      default: 2 // ✅ 수정: 78장 덱 지원 버전
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true
    },

    // 🌍 환경 정보
    timezone: {
      type: String,
      required: true,
      default: "Asia/Seoul"
    }
  },
  {
    // Mongoose 옵션
    collection: "fortune_records",
    timestamps: {
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    },
    versionKey: "version"
  }
);

/**
 * 🔍 인덱스 설정 (78장 덱 최적화)
 */
FortuneUserSchema.index({ lastDrawDate: 1 });
FortuneUserSchema.index({ "drawHistory.date": 1 });
FortuneUserSchema.index({ "drawHistory.cardId": 1 }); // ✅ 추가: 카드별 통계용
FortuneUserSchema.index({ "drawHistory.arcana": 1 }); // ✅ 추가: 아르카나별 통계용
FortuneUserSchema.index({ "drawHistory.timestamp": -1 });
FortuneUserSchema.index({ totalDraws: -1 });
FortuneUserSchema.index({ createdAt: -1 });

/**
 * 🎯 가상 필드 (Virtual Fields) - 78장 덱용 확장
 */
// 오늘 뽑기 가능 여부
FortuneUserSchema.virtual("canDrawToday").get(function () {
  const today = new Date().toISOString().split("T")[0];
  return this.lastDrawDate !== today || (this.todayDrawCount || 0) < 3;
});

// 오늘 남은 뽑기 횟수
FortuneUserSchema.virtual("remainingDrawsToday").get(function () {
  const today = new Date().toISOString().split("T")[0];
  if (this.lastDrawDate !== today) {
    return 3; // 새로운 날이면 3번 모두 가능
  }
  return Math.max(0, 3 - (this.todayDrawCount || 0));
});

// 메이저/마이너 아르카나 비율
FortuneUserSchema.virtual("arcanaRatio").get(function () {
  const total = this.dailyStats.majorArcanaDraws + this.dailyStats.minorArcanaDraws;
  if (total === 0) return { major: 0, minor: 0 };

  return {
    major: Math.round((this.dailyStats.majorArcanaDraws / total) * 100),
    minor: Math.round((this.dailyStats.minorArcanaDraws / total) * 100)
  };
});

/**
 * 🔧 인스턴스 메서드 - 78장 덱용 확장
 */
// 뽑기 기록에 두목 멘트 추가 (78장 덱 지원)
FortuneUserSchema.methods.recordDraw = function (cardData, userName) {
  const today = new Date().toISOString().split("T")[0];

  // 두목의 카드별 특별 멘트 생성
  const doomockComment = this.constructor.getDoomockMessage("cardSpecific", userName, cardData);

  // 히스토리에 추가
  this.drawHistory.push({
    date: today,
    cardId: cardData.cardId || cardData.id,
    cardName: cardData.cardName || cardData.name,
    koreanName: cardData.koreanName || cardData.korean,
    isReversed: cardData.isReversed || false,
    drawType: cardData.drawType || cardData.type,
    position: cardData.position,
    arcana: cardData.arcana, // ✅ 추가
    suit: cardData.suit, // ✅ 추가
    question: cardData.question, // ✅ 추가
    doomockComment: doomockComment,
    timestamp: new Date()
  });

  // 통계 업데이트
  this.totalDraws += 1;
  this.lastDrawDate = today;
  this.lastDrawTimestamp = new Date();

  // ✅ 수정: 오늘 뽑기 횟수 업데이트
  if (this.lastDrawDate === today) {
    this.todayDrawCount = (this.todayDrawCount || 0) + 1;
  } else {
    this.todayDrawCount = 1;
  }

  // ✅ 추가: 아르카나별 통계 업데이트
  if (cardData.arcana === "major") {
    this.dailyStats.majorArcanaDraws += 1;
  } else if (cardData.arcana === "minor") {
    this.dailyStats.minorArcanaDraws += 1;
  }

  // ✅ 추가: 캘틱 크로스 횟수 업데이트
  if (cardData.drawType === "celtic" || cardData.type === "celtic") {
    this.dailyStats.celticCrossCount += 1;
  }

  // 연속 사용 일수 계산
  this.updateStreakCount(today);

  // ✅ 추가: 선호 카드 업데이트
  this.updateFavoriteCards(cardData.cardId || cardData.id, cardData);

  return this.save();
};

// ✅ 수정: 선호 카드 업데이트 (78장 덱 지원)
FortuneUserSchema.methods.updateFavoriteCards = function (cardId, cardData) {
  const existing = this.preferences.favoriteCards.find((card) => card.cardId === cardId);

  if (existing) {
    existing.drawCount += 1;
  } else {
    this.preferences.favoriteCards.push({
      cardId,
      cardName: cardData.cardName || cardData.name,
      koreanName: cardData.koreanName || cardData.korean,
      arcana: cardData.arcana,
      drawCount: 1
    });
  }

  // 상위 10개까지 유지 (78장 덱이므로 더 많이)
  this.preferences.favoriteCards.sort((a, b) => b.drawCount - a.drawCount);
  this.preferences.favoriteCards = this.preferences.favoriteCards.slice(0, 10);
};

/**
 * 🎭 정적 메서드 (Static Methods) - 78장 덱용 확장
 */
// ✅ 추가: 카드 ID 유효성 검사
FortuneUserSchema.statics.isValidCardId = function (cardId) {
  // 메이저 아르카나: 0-21
  if (cardId >= 0 && cardId <= 21) return true;

  // 마이너 아르카나: 100-155 (4슈트 × 14장)
  if (cardId >= 100 && cardId <= 155) return true;

  return false;
};

// ✅ 추가: 인기 카드 통계 (78장 덱용)
FortuneUserSchema.statics.getPopularCards = async function (limit = 20) {
  return this.aggregate([
    { $unwind: "$drawHistory" },
    {
      $group: {
        _id: {
          cardId: "$drawHistory.cardId",
          cardName: "$drawHistory.cardName",
          koreanName: "$drawHistory.koreanName",
          arcana: "$drawHistory.arcana"
        },
        count: { $sum: 1 },
        reversedCount: {
          $sum: { $cond: ["$drawHistory.isReversed", 1, 0] }
        }
      }
    },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);
};

// ✅ 추가: 아르카나별 통계
FortuneUserSchema.statics.getArcanaStats = async function () {
  return this.aggregate([
    { $unwind: "$drawHistory" },
    {
      $group: {
        _id: "$drawHistory.arcana",
        count: { $sum: 1 },
        uniqueUsers: { $addToSet: "$userId" }
      }
    },
    {
      $project: {
        _id: 1,
        count: 1,
        uniqueUsers: { $size: "$uniqueUsers" }
      }
    }
  ]);
};

/**
 * 🔮 모델 생성 및 내보내기
 */
const FortuneUser = mongoose.model("FortuneUser", FortuneUserSchema);

module.exports = {
  FortuneUser,
  FortuneUserSchema,
  DrawHistorySchema
};
