// src/database/models/Weather.js - 🌤️ 표준 스키마 리팩토링

const mongoose = require("mongoose");
const logger = require("../../utils/Logger");
const TimeHelper = require("../../utils/TimeHelper");

/**
 * 🌤️ Weather Mongoose 스키마 - 표준 규칙 준수
 *
 * 🎯 핵심 원칙:
 * - 순수한 데이터 스키마만 정의
 * - 비즈니스 로직은 Service로 분리
 * - 표준 인덱스 및 미들웨어 적용
 * - 가상 속성으로 계산된 값 제공
 */

const weatherSchema = new mongoose.Schema(
  {
    // 👤 사용자 정보 (표준)
    userId: {
      type: String,
      required: [true, "사용자 ID는 필수입니다"],
      // index는 복합 인덱스에서 처리
    },

    // 📍 위치 정보
    location: {
      type: String,
      required: [true, "위치 정보는 필수입니다"],
      trim: true,
      maxlength: [100, "위치명은 100자를 초과할 수 없습니다"],
    },

    cityName: {
      type: String,
      required: true,
      trim: true,
    },

    country: {
      type: String,
      default: "KR",
      uppercase: true,
      minlength: 2,
      maxlength: 2,
    },

    coordinates: {
      lat: {
        type: Number,
        min: [-90, "위도는 -90도 이상이어야 합니다"],
        max: [90, "위도는 90도 이하여야 합니다"],
      },
      lon: {
        type: Number,
        min: [-180, "경도는 -180도 이상이어야 합니다"],
        max: [180, "경도는 180도 이하여야 합니다"],
      },
    },

    // 🌡️ 온도 데이터
    temperature: {
      type: Number,
      required: [true, "온도 정보는 필수입니다"],
      min: [-50, "온도는 -50도 이상이어야 합니다"],
      max: [60, "온도는 60도 이하여야 합니다"],
    },

    feelsLike: {
      type: Number,
      min: -50,
      max: 60,
    },

    tempMin: {
      type: Number,
      min: -50,
      max: 60,
    },

    tempMax: {
      type: Number,
      min: -50,
      max: 60,
    },

    // 🌤️ 날씨 상태
    condition: {
      type: String,
      required: true,
      enum: {
        values: [
          "Clear",
          "Clouds",
          "Rain",
          "Drizzle",
          "Snow",
          "Thunderstorm",
          "Mist",
          "Fog",
        ],
        message: "지원하지 않는 날씨 상태입니다",
      },
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, "날씨 설명은 100자를 초과할 수 없습니다"],
    },

    iconCode: {
      type: String,
      required: true,
      match: [/^[0-9]{2}[dn]$/, "올바른 아이콘 코드 형식이 아닙니다"],
    },

    // 💨 환경 데이터
    humidity: {
      type: Number,
      required: true,
      min: [0, "습도는 0% 이상이어야 합니다"],
      max: [100, "습도는 100% 이하여야 합니다"],
    },

    pressure: {
      type: Number,
      min: [800, "기압은 800hPa 이상이어야 합니다"],
      max: [1200, "기압은 1200hPa 이하여야 합니다"],
    },

    windSpeed: {
      type: Number,
      default: 0,
      min: [0, "풍속은 0 이상이어야 합니다"],
      max: [200, "풍속은 200m/s 이하여야 합니다"],
    },

    windDeg: {
      type: Number,
      min: [0, "풍향은 0도 이상이어야 합니다"],
      max: [360, "풍향은 360도 이하여야 합니다"],
    },

    cloudiness: {
      type: Number,
      default: 0,
      min: [0, "구름량은 0% 이상이어야 합니다"],
      max: [100, "구름량은 100% 이하여야 합니다"],
    },

    visibility: {
      type: Number,
      min: [0, "가시거리는 0km 이상이어야 합니다"],
    },

    // 🌅 태양 데이터
    sunrise: {
      type: String,
      match: [
        /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
        "올바른 시간 형식이 아닙니다 (HH:MM)",
      ],
    },

    sunset: {
      type: String,
      match: [
        /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
        "올바른 시간 형식이 아닙니다 (HH:MM)",
      ],
    },

    // 📡 메타 정보
    meta: {
      source: {
        type: String,
        required: true,
        enum: ["OpenWeatherMap", "폴백 데이터", "캐시"],
        default: "OpenWeatherMap",
      },
      hasApiData: {
        type: Boolean,
        default: false,
      },
      estimated: {
        type: Boolean,
        default: false,
      },
      cacheExpiry: {
        type: Date,
      },
    },

    // 📊 상태 관리
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    // 📅 시간 정보 (자동 관리)
    lastUpdate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // Mongoose 표준 옵션
    timestamps: true, // createdAt, updatedAt 자동 생성
    versionKey: false,
    collection: "weather_data",

    // JSON 변환 옵션
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

// ===== 🔍 인덱스 설정 (표준 규칙) =====

// 사용자별 최신 날씨 조회용 복합 인덱스
weatherSchema.index({ userId: 1, createdAt: -1 });

// 위치별 날씨 조회용 복합 인덱스
weatherSchema.index({ location: 1, createdAt: -1 });

// 활성 상태별 조회용
weatherSchema.index({ isActive: 1 });

// 캐시 만료 관리용
weatherSchema.index({ "meta.cacheExpiry": 1 }, { sparse: true });

// 지리적 위치 검색용 (2dsphere 인덱스)
weatherSchema.index({ coordinates: "2dsphere" });

// ===== 🎨 가상 속성 (Virtual Properties) =====

/**
 * 날씨 아이콘 이모지
 */
weatherSchema.virtual("icon").get(function () {
  const iconMapping = {
    "01d": "☀️",
    "01n": "🌙",
    "02d": "⛅",
    "02n": "☁️",
    "03d": "☁️",
    "03n": "☁️",
    "04d": "☁️",
    "04n": "☁️",
    "09d": "🌧️",
    "09n": "🌧️",
    "10d": "🌦️",
    "10n": "🌧️",
    "11d": "⛈️",
    "11n": "⛈️",
    "13d": "❄️",
    "13n": "❄️",
    "50d": "🌫️",
    "50n": "🌫️",
  };
  return iconMapping[this.iconCode] || "🌤️";
});

/**
 * 바람 방향 문자열
 */
weatherSchema.virtual("windDirection").get(function () {
  if (!this.windDeg) return "무풍";

  const directions = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];
  const index = Math.round(this.windDeg / 45) % 8;
  return directions[index];
});

/**
 * 날씨 요약
 */
weatherSchema.virtual("summary").get(function () {
  let summary = `현재 기온 ${this.temperature}°C`;

  if (this.temperature >= 30) summary += " (매우 더움)";
  else if (this.temperature >= 25) summary += " (더움)";
  else if (this.temperature >= 20) summary += " (따뜻함)";
  else if (this.temperature >= 10) summary += " (쌀쌀함)";
  else if (this.temperature >= 0) summary += " (추움)";
  else summary += " (매우 추움)";

  summary += `, ${this.description}`;

  if (this.windSpeed > 3) {
    summary += `, 바람 ${this.windSpeed}m/s`;
  }

  return summary;
});

/**
 * 캐시 유효성 확인
 */
weatherSchema.virtual("isCacheValid").get(function () {
  if (!this.meta.cacheExpiry) return false;
  return new Date() < this.meta.cacheExpiry;
});

/**
 * 데이터 신뢰도
 */
weatherSchema.virtual("reliability").get(function () {
  if (this.meta.hasApiData && !this.meta.estimated) return "높음";
  if (this.meta.hasApiData && this.meta.estimated) return "보통";
  return "낮음";
});

// ===== 🔧 미들웨어 (Middleware) =====

/**
 * 저장 전 처리
 */
weatherSchema.pre("save", function (next) {
  // lastUpdate 갱신
  this.lastUpdate = new Date();

  // 캐시 만료 시간 설정 (10분 후)
  if (!this.meta.cacheExpiry) {
    this.meta.cacheExpiry = new Date(Date.now() + 10 * 60 * 1000);
  }

  next();
});

/**
 * 업데이트 전 처리
 */
weatherSchema.pre(["updateOne", "findOneAndUpdate"], function (next) {
  this.set({
    lastUpdate: new Date(),
  });

  next();
});

/**
 * 저장 후 로깅
 */
weatherSchema.post("save", function (doc) {
  if (doc.isNew) {
    logger.debug(
      `🌤️ 새 날씨 데이터 저장: ${doc.location} (${doc.temperature}°C)`
    );
  }
});

// ===== 🛠️ 인스턴스 메서드 (Instance Methods) =====

/**
 * 데이터 유효성 검사
 */
weatherSchema.methods.validateData = function () {
  const errors = [];

  if (!this.location) errors.push("위치 정보가 없습니다");
  if (this.temperature === null || this.temperature === undefined) {
    errors.push("온도 정보가 없습니다");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * 캐시 만료 처리
 */
weatherSchema.methods.expireCache = function () {
  this.meta.cacheExpiry = new Date();
  return this.save();
};

/**
 * 소프트 삭제
 */
weatherSchema.methods.softDelete = function () {
  this.isActive = false;
  return this.save();
};

// ===== 📊 정적 메서드 (Static Methods) =====

/**
 * 사용자의 최신 날씨 데이터 조회
 */
weatherSchema.statics.findLatestByUser = function (userId, location = null) {
  const query = {
    userId: String(userId),
    isActive: true,
  };

  if (location) {
    query.location = location;
  }

  return this.findOne(query).sort({ createdAt: -1 });
};

/**
 * 유효한 캐시 데이터 조회
 */
weatherSchema.statics.findValidCache = function (userId, location) {
  return this.findOne({
    userId: String(userId),
    location,
    isActive: true,
    "meta.cacheExpiry": { $gt: new Date() },
  }).sort({ createdAt: -1 });
};

/**
 * 만료된 캐시 정리
 */
weatherSchema.statics.cleanExpiredCache = async function () {
  const result = await this.updateMany(
    {
      "meta.cacheExpiry": { $lt: new Date() },
      isActive: true,
    },
    {
      $set: { isActive: false },
    }
  );

  if (result.modifiedCount > 0) {
    logger.info(`🧹 만료된 날씨 캐시 ${result.modifiedCount}개 정리 완료`);
  }

  return result;
};

/**
 * 사용자별 날씨 기록 통계
 */
weatherSchema.statics.getUserStats = async function (userId) {
  const stats = await this.aggregate([
    {
      $match: {
        userId: String(userId),
        isActive: true,
      },
    },
    {
      $group: {
        _id: null,
        totalRecords: { $sum: 1 },
        avgTemperature: { $avg: "$temperature" },
        maxTemperature: { $max: "$temperature" },
        minTemperature: { $min: "$temperature" },
        locations: { $addToSet: "$location" },
        lastUpdate: { $max: "$createdAt" },
      },
    },
  ]);

  return (
    stats[0] || {
      totalRecords: 0,
      avgTemperature: 0,
      maxTemperature: 0,
      minTemperature: 0,
      locations: [],
      lastUpdate: null,
    }
  );
};

// ===== 🏭 모델 생성 및 내보내기 =====

const Weather = mongoose.model("Weather", weatherSchema);

module.exports = Weather;
