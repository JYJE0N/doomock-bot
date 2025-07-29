// src/database/models/Fortune.js - 중복 인덱스 제거 버전

const mongoose = require("mongoose");

/**
 * 🔮 타로 운세 사용자 기록 스키마
 * 컬렉션명: fortune_records
 *
 * 🎯 기능:
 * - 사용자별 타로 뽑기 기록 관리
 * - 일일 제한 체크 (하루 1회)
 * - 뽑기 히스토리 저장
 * - 두목봇 캐릭터 멘트 포함
 */

// 개별 카드 뽑기 기록 서브스키마
const DrawHistorySchema = new mongoose.Schema(
  {
    date: {
      type: String, // YYYY-MM-DD 형태
      required: true,
      // ✅ 여기서 index 제거 (아래에서 복합 인덱스로 처리)
    },
    cardId: {
      type: Number, // 0-21 (메이저 아르카나)
      required: true,
      min: 0,
      max: 21,
    },
    cardName: {
      type: String, // "The Fool", "The Magician" 등
      required: true,
      maxLength: 50,
    },
    koreanName: {
      type: String, // "바보", "마법사" 등
      required: true,
      maxLength: 20,
    },
    isReversed: {
      type: Boolean, // 정방향(false) / 역방향(true)
      required: true,
      default: false,
    },
    drawType: {
      type: String, // "single" | "triple"
      required: true,
      enum: ["single", "triple"],
    },
    position: {
      type: String, // 3장 뽑기시: "past" | "present" | "future"
      required: false,
      enum: ["past", "present", "future"],
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
    // 두목봇 특별 멘트 저장
    doomockComment: {
      type: String,
      required: false,
      maxLength: 200,
    },
  },
  {
    _id: true, // 서브도큐먼트도 ID 자동 생성
  }
);

// 메인 사용자 기록 스키마
const FortuneUserSchema = new mongoose.Schema(
  {
    // 🔑 사용자 식별
    userId: {
      type: Number,
      required: true,
      unique: true, // ✅ unique만 유지 (자동으로 인덱스 생성됨)
      // index: true 제거 - unique가 이미 인덱스를 생성함
    },
    userName: {
      type: String,
      required: false,
      maxLength: 50,
      trim: true,
    },

    // 📊 통계 정보
    totalDraws: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    lastDrawDate: {
      type: String, // YYYY-MM-DD 형태 (일일 제한용)
      required: false,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    lastDrawTimestamp: {
      type: Date,
      required: false,
    },

    // 📈 선호도 분석 (향후 개인화용)
    preferences: {
      favoriteCards: [
        {
          cardId: Number,
          cardName: String,
          drawCount: { type: Number, default: 1 },
        },
      ],
      mostReversed: {
        type: Boolean, // 역방향을 더 많이 뽑는지
        default: false,
      },
      preferredDrawType: {
        type: String,
        enum: ["single", "triple", "mixed"],
        default: "mixed",
      },
    },

    // 📋 뽑기 히스토리
    drawHistory: [DrawHistorySchema],

    // 🌙 일일 제한 관련
    dailyStats: {
      currentStreak: {
        // 연속 사용 일수
        type: Number,
        default: 0,
        min: 0,
      },
      longestStreak: {
        // 최장 연속 사용 일수
        type: Number,
        default: 0,
        min: 0,
      },
      totalDaysUsed: {
        // 총 사용 일수
        type: Number,
        default: 0,
        min: 0,
      },
    },

    // ⏰ 타임스탬프 (자동 관리)
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
      // index: true 제거 - 아래에서 설정
    },
    updatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    // 🏷️ 메타데이터
    version: {
      type: Number,
      required: true,
      default: 1,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },

    // 🌍 환경 정보
    timezone: {
      type: String,
      required: true,
      default: "Asia/Seoul",
    },
  },
  {
    // Mongoose 옵션
    collection: "fortune_records",
    timestamps: {
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
    versionKey: "version",
  }
);

/**
 * 🔍 인덱스 설정 (성능 최적화) - ✅ 중복 제거
 */
// userId는 unique: true로 인해 자동 인덱스 생성되므로 별도 설정 불필요
FortuneUserSchema.index({ lastDrawDate: 1 });
FortuneUserSchema.index({ "drawHistory.date": 1 }); // ✅ 하나만 유지
FortuneUserSchema.index({ "drawHistory.timestamp": -1 });
FortuneUserSchema.index({ totalDraws: -1 });
FortuneUserSchema.index({ createdAt: -1 }); // ✅ 여기서만 설정

/**
 * 🎯 가상 필드 (Virtual Fields)
 */
// 오늘 뽑기 가능 여부
FortuneUserSchema.virtual("canDrawToday").get(function () {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return this.lastDrawDate !== today;
});

// 이번달 뽑기 횟수
FortuneUserSchema.virtual("thisMonthDraws").get(function () {
  const thisMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  return this.drawHistory.filter((draw) =>
    draw.date.startsWith(thisMonth)
  ).length;
});

/**
 * 🔧 인스턴스 메서드
 */
// 뽑기 기록에 두목 멘트 추가
FortuneUserSchema.methods.recordDraw = function (cardData, userName) {
  const today = new Date().toISOString().split("T")[0];

  // 두목의 카드별 특별 멘트 생성
  const doomockComment = this.constructor.getDoomockMessage(
    "cardSpecific",
    userName,
    cardData
  );

  // 히스토리에 추가
  this.drawHistory.push({
    date: today,
    cardId: cardData.cardId,
    cardName: cardData.cardName,
    koreanName: cardData.koreanName,
    isReversed: cardData.isReversed,
    drawType: cardData.drawType,
    position: cardData.position,
    doomockComment: doomockComment,
    timestamp: new Date(),
  });

  // 통계 업데이트
  this.totalDraws += 1;
  this.lastDrawDate = today;
  this.lastDrawTimestamp = new Date();

  // 연속 사용 일수 계산
  this.updateStreakCount(today);

  return this.save();
};

// 연속 사용 일수 업데이트
FortuneUserSchema.methods.updateStreakCount = function (today) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  if (this.lastDrawDate === yesterdayStr) {
    // 어제도 사용했으면 연속
    this.dailyStats.currentStreak += 1;
  } else if (this.lastDrawDate !== today) {
    // 연속이 끊어졌으면 리셋
    this.dailyStats.currentStreak = 1;
  }

  // 최장 기록 갱신
  if (this.dailyStats.currentStreak > this.dailyStats.longestStreak) {
    this.dailyStats.longestStreak = this.dailyStats.currentStreak;
  }

  // 총 사용 일수 업데이트 (오늘이 처음이면)
  if (this.lastDrawDate !== today) {
    this.dailyStats.totalDaysUsed += 1;
  }
};

// 선호 카드 업데이트
FortuneUserSchema.methods.updateFavoriteCards = function (cardId, cardName) {
  const existing = this.preferences.favoriteCards.find(
    (card) => card.cardId === cardId
  );

  if (existing) {
    existing.drawCount += 1;
  } else {
    this.preferences.favoriteCards.push({
      cardId,
      cardName,
      drawCount: 1,
    });
  }

  // 상위 5개만 유지
  this.preferences.favoriteCards.sort((a, b) => b.drawCount - a.drawCount);
  this.preferences.favoriteCards = this.preferences.favoriteCards.slice(0, 5);
};

/**
 * 🎭 정적 메서드 (Static Methods)
 */
// 사용자 기록 조회 또는 생성
FortuneUserSchema.statics.findOrCreateUser = async function (userId, userName) {
  let user = await this.findOne({ userId });

  if (!user) {
    user = new this({
      userId,
      userName,
      totalDraws: 0,
      drawHistory: [],
      dailyStats: {
        currentStreak: 0,
        longestStreak: 0,
        totalDaysUsed: 0,
      },
      preferences: {
        favoriteCards: [],
        mostReversed: false,
        preferredDrawType: "mixed",
      },
    });

    await user.save();
  }

  return user;
};

// 오늘 뽑기 가능한 사용자인지 체크
FortuneUserSchema.statics.canUserDrawToday = async function (userId) {
  const user = await this.findOne({ userId });
  if (!user) return true; // 신규 사용자는 가능

  const today = new Date().toISOString().split("T")[0];
  return user.lastDrawDate !== today;
};

// 인기 카드 통계
FortuneUserSchema.statics.getPopularCards = async function (limit = 10) {
  return this.aggregate([
    { $unwind: "$drawHistory" },
    {
      $group: {
        _id: {
          cardId: "$drawHistory.cardId",
          cardName: "$drawHistory.cardName",
        },
        count: { $sum: 1 },
        reversedCount: {
          $sum: { $cond: ["$drawHistory.isReversed", 1, 0] },
        },
      },
    },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);
};

/**
 * 🎭 두목봇 캐릭터 멘트 생성 헬퍼
 */
FortuneUserSchema.statics.getDoomockMessage = function (
  type,
  userName,
  cardData = null
) {
  const name = userName ? `${userName}씨` : "당신";

  const messages = {
    // 🔀 셔플링 메시지들
    shuffle: [
      `👔 두목: '${name}, 제가 직접 카드를 골라드리겠소...'`,
      `🧠 두목: '${name}을 위해 집중하고 있어소'`,
      `💼 두목: '${name}의 운세를 위해 제 직감을 총동원하겠습니다!'`,
      `📊 두목: '${name}, 확률 계산 중... 아니, 그냥 감으로 갑시다!'`,
      `🎯 두목: '${name}을 위한 특별한 카드를 찾고 있습니다...'`,
      `💭 두목: '${name}, 지금까지의 생활을 떠올리며...'`,
    ],

    // 🌙 일일 제한 메시지들
    dailyLimit: [
      `👔 두목: '${name}, 오늘은 이미 뽑으셨군요!'`,
      `🛑 두목: '${name}, 저도 하루에 한 번만 집중할 수 있어요.'`,
      `☕ 두목: '${name}, 내일 출근해서 다시 봐드릴게요!'`,
      `📅 두목: '${name}, 하루 하나의 조언이면 충분하죠!'`,
      `🌙 두목: '${name}, 내일 다시 만나요! 퇴근하세요~'`,
      `💼 두목: '${name}, 오늘의 운세는 끝! 업무에 집중하세요!'`,
    ],

    // ✨ 마무리 멘트들
    ending: [
      `👔 두목: '${name}, 오늘의 운세는 여기까지입니다. 수고하세요!'`,
      `💼 두목: '${name}, 업무에 참고하시길! 화이팅!'`,
      `☕두목: '${name}, 커피 한 잔 하고 오세요!'`,
      `📊 두목: '${name}, 데이터도 중요하지만 직감도 중요해요!'`,
      `🎯 두목: '${name}, 오늘 하루도 열심히 하세요!'`,
      `💪 두목: '${name}, 좋은 결과 있으시길 바라요!'`,
      `🤝 두목: '${name}, 언제든 궁금한 게 있으면 말씀하세요!'`,
    ],

    // 🎴 카드별 특별 멘트들
    cardSpecific: {
      0: [
        // The Fool
        `👔 두목: '${name}, 바보 카드네요! 새로운 시작에 좋아요!'`,
        `🤡 두목: '${name}, 순수한 마음으로 도전해보세요!'`,
      ],
      1: [
        // The Magician
        `👔 두목: '${name}, 마법사 카드! 능력을 발휘할 때네요!'`,
        `🎩 두목: '${name}, 지금이 실행할 때입니다!'`,
      ],
      13: [
        // Death
        `👔 두목: '${name}, 죽음 카드라고 무서워하지 마세요. 변화의 시작이에요!'`,
        `💀 두목: '${name}, 이건 좋은 변화를 의미합니다. 믿어보세요!'`,
      ],
      19: [
        // The Sun
        `👔 두목: '${name}, 태양 카드! 최고의 컨디션이네요!'`,
        `☀️ 두목: '${name}, 오늘은 뭘 해도 잘 될 것 같아요!'`,
      ],
    },
  };

  // 카드별 특별 멘트가 있으면 우선 사용
  if (
    type === "cardSpecific" &&
    cardData &&
    messages.cardSpecific[cardData.cardId]
  ) {
    const cardMessages = messages.cardSpecific[cardData.cardId];
    return cardMessages[Math.floor(Math.random() * cardMessages.length)];
  }

  // 일반 메시지 랜덤 선택
  const typeMessages = messages[type] || messages.ending;
  return typeMessages[Math.floor(Math.random() * typeMessages.length)];
};

/**
 * 🎯 미들웨어 (Middleware)
 */
// 저장 전 처리
FortuneUserSchema.pre("save", function (next) {
  // 히스토리 최대 100개로 제한 (메모리 절약)
  if (this.drawHistory.length > 100) {
    this.drawHistory = this.drawHistory.slice(-100);
  }

  next();
});

// 조회 후 처리
FortuneUserSchema.post("find", function (docs) {
  // 비활성 사용자 필터링 등 추가 로직
});

/**
 * 🔮 모델 생성 및 내보내기
 */
const FortuneUser = mongoose.model("FortuneUser", FortuneUserSchema);

module.exports = {
  FortuneUser,
  FortuneUserSchema,
  DrawHistorySchema,
};
