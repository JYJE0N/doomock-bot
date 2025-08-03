// database/models/Weather.js
// 🌤️ Weather 데이터 모델 - 순수한 스키마 정의만!

const mongoose = require("mongoose");

/**
 * Weather 스키마 - SoC 원칙 준수
 * ✅ 역할: 데이터 구조 정의
 * ❌ 금지: 비즈니스 로직, Mock 데이터 생성
 */
const weatherSchema = new mongoose.Schema(
  {
    // 사용자 정보
    userId: {
      type: String,
      required: true
    },

    // 위치 정보
    location: {
      type: String,
      required: true,
      trim: true
    },

    cityName: {
      type: String,
      required: true,
      trim: true
    },

    // 온도 데이터
    temperature: {
      type: Number,
      required: true
    },

    feelsLike: {
      type: Number
    },

    tempMin: {
      type: Number
    },

    tempMax: {
      type: Number
    },

    // 날씨 상태
    description: {
      type: String,
      required: true
    },

    iconCode: {
      type: String,
      required: true
    },

    // 환경 데이터
    humidity: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },

    pressure: {
      type: Number
    },

    windSpeed: {
      type: Number,
      default: 0
    },

    cloudiness: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },

    // 메타 정보
    meta: {
      source: {
        type: String,
        enum: ["api", "cache"],
        default: "api"
      },
      apiProvider: {
        type: String,
        default: "OpenWeatherMap"
      }
    },

    // 상태 관리
    isActive: {
      type: Boolean,
      default: true
    },

    // 캐시 만료 시간
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 10 * 60 * 1000) // 10분
    }
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "weather_data"
  }
);

// 인덱스 설정
weatherSchema.index({ userId: 1, createdAt: -1 });
weatherSchema.index({ location: 1, createdAt: -1 });
weatherSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// 가상 속성 - 화씨 온도
weatherSchema.virtual("temperatureF").get(function () {
  return Math.round((this.temperature * 9) / 5 + 32);
});

// 가상 속성 - 캐시 유효성
weatherSchema.virtual("isCacheValid").get(function () {
  return this.expiresAt > new Date();
});

// 모델 생성 및 내보내기
module.exports = mongoose.model("Weather", weatherSchema);
