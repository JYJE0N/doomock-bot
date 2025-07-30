// src/utils/AirQualityHelper.js - Mongoose 사용 버전

const axios = require("axios");
const mongoose = require("mongoose");
const logger = require("./Logger");
const TimeHelper = require("./TimeHelper");

/**
 * 🌬️ AirQualityHelper - 미세먼지 데이터 조회 헬퍼
 *
 * 🔧 수정사항:
 * - Mongoose 라이브러리 사용 ✨
 * - "안산" 측정소 오류 해결을 위한 대체 측정소 확장
 * - API 키 디코딩 처리 개선
 * - 사용자별 위치 캐싱 추가
 */

// 📍 사용자 위치 Mongoose 스키마
const UserLocationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    location: {
      city: { type: String, required: true },
      country: { type: String, default: "KR" },
      detectedAt: { type: Date, default: Date.now },
      method: {
        type: String,
        enum: ["gps", "manual", "api_success"],
        default: "manual",
      },
    },
    isActive: { type: Boolean, default: true },
    version: { type: Number, default: 1 },
  },
  {
    timestamps: true,
    collection: "user_locations",
  }
);

// TTL 인덱스 (24시간 후 자동 삭제)
UserLocationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

class AirQualityHelper {
  constructor(options = {}) {
    // 🔑 API 키 설정 및 디코딩 처리
    const rawApiKey =
      process.env.AIR_KOREA_API_KEY ||
      process.env.AIR_QUALITY_API_KEY ||
      process.env.DUST_API_KEY;

    // ✅ API 키가 있으면 디코딩 처리
    if (rawApiKey) {
      this.apiKey = this.processApiKey(rawApiKey);
      logger.info(`🔑 API 키 처리 완료`, {
        hasApiKey: true,
        isDecoded: rawApiKey !== this.apiKey,
        keyPrefix: this.apiKey.substring(0, 10) + "...",
      });
    } else {
      this.apiKey = null;
      logger.warn("⚠️ API 키가 설정되지 않음");
    }

    this.baseUrl = "http://apis.data.go.kr/B552584/ArpltnInforInqireSvc";

    // 🗄️ Mongoose 모델 설정
    this.UserLocation =
      mongoose.models.UserLocation ||
      mongoose.model("UserLocation", UserLocationSchema);

    // 캐시 설정
    this.cache = new Map();
    this.cacheTimeout = 60 * 60 * 1000; // 1시간

    // 🗺️ 지역별 측정소 매핑 (영문 → 한글)
    // 🗺️ 지역별 측정소 매핑 (영문 → 실제 측정소명)
    this.locationMapping = {
      // 용인시
      용인시: "수지", // ✅ 정확한 측정소명
      "용인시 수지구": "수지",
      "용인시 기흥구": "기흥",
      "용인시 처인구": "김량장",

      // 수원시
      수원시: "인계동",
      "수원시 영통구": "영통동",
      "수원시 장안구": "천천동",
      "수원시 권선구": "고색동",
      "수원시 팔달구": "인계동",

      // 화성시
      화성시: "동탄",
      "화성시 동탄": "동탄",
      "화성시 남양": "남양읍",
      "화성시 향남": "향남읍",

      // 성남시
      성남시: "성남",
      "성남시 분당구": "정자1동",
      "성남시 수정구": "신흥동",
      "성남시 중원구": "성남대로",

      // 경기도 - 고양시
      Goyang: "주엽동",
      "Goyang-si": "주엽동",
      고양시: "주엽동",
      고양: "주엽동",

      // 경기도 - 안산시
      Ansan: "고잔동",
      "Ansan-si": "고잔동",
      안산시: "고잔동",
      안산: "고잔동",

      // 서울
      Seoul: "종로구",
      서울: "종로구",
      서울시: "종로구",
      서울특별시: "종로구",

      // 부산
      Busan: "광복동",
      부산: "광복동",
      부산시: "광복동",
      부산광역시: "광복동",

      // 대구
      Daegu: "수창동",
      대구: "수창동",
      대구시: "수창동",
      대구광역시: "수창동",

      // 인천
      Incheon: "구월동",
      인천: "구월동",
      인천시: "구월동",
      인천광역시: "구월동",

      // 광주
      Gwangju: "농성동",
      광주: "농성동",
      광주시: "농성동",
      광주광역시: "농성동",

      // 대전
      Daejeon: "문창동",
      대전: "문창동",
      대전시: "문창동",
      대전광역시: "문창동",

      // 울산
      Ulsan: "삼산동",
      울산: "삼산동",
      울산시: "삼산동",
      울산광역시: "삼산동",
    };

    // 🎯 지역별 대체 측정소 (실제 측정소명 사용)
    this.fallbackStations = {
      // 용인시 주변
      용인시: ["용인수지", "용인기흥", "김량장동", "수지구", "기흥구"],

      용인시: ["용인수지", "용인기흥", "김량장동", "수지구", "기흥구"],
      수원시: ["인계동", "영통동", "천천동", "권선구"],
      화성시: ["동탄", "남양", "향남", "병점"],

      // 화성시 주변
      동탄: ["동탄", "남양", "향남", "병점", "영통동", "인계동"],
      남양: ["남양", "동탄", "향남", "병점", "안산동", "고잔동"],

      // 수원시 주변
      인계동: ["인계동", "영통동", "천천동", "신풍", "권선구", "팔달구"],
      영통동: ["영통동", "인계동", "천천동", "신풍", "용인수지", "동탄"],

      // 성남시 주변
      수정구: ["수정구", "분당구", "중원구", "복정동", "모란", "야탑동"],
      분당구: ["분당구", "수정구", "중원구", "야탑동", "서현동", "정자동"],

      // 서울 주요 측정소
      종로구: ["종로구", "중구", "용산구", "서대문구", "종로", "세종대로"],
      강남구: ["강남구", "서초구", "송파구", "강동구", "역삼동", "삼성동"],

      // 기본 폴백
      default: ["종로구", "인계동", "분당구", "동탄"],
    };

    logger.info("🌬️ AirQualityHelper 초기화됨 (Mongoose 버전)", {
      hasApiKey: !!this.apiKey,
      hasMongoose: !!mongoose.connection.readyState,
    });
  }

  /**
   * 🗄️ Mongoose 연결 확인 (더 이상 initializeDatabase 불필요)
   */
  checkMongooseConnection() {
    if (mongoose.connection.readyState !== 1) {
      logger.warn("⚠️ Mongoose 연결이 준비되지 않음 - 메모리 캐시만 사용");
      return false;
    }
    return true;
  }

  /**
   * 🔑 API 키 처리 (디코딩)
   */
  processApiKey(rawKey) {
    if (!rawKey) return null;

    try {
      // 키가 이미 URL 인코딩되어 있는지 확인
      const hasEncodedChars = rawKey.includes("%") || rawKey.includes("+");

      if (hasEncodedChars) {
        // URL 디코딩 수행
        const decodedKey = decodeURIComponent(rawKey);
        logger.debug("🔓 API 키 디코딩됨", {
          original: rawKey.substring(0, 20) + "...",
          decoded: decodedKey.substring(0, 20) + "...",
          changed: rawKey !== decodedKey,
        });
        return decodedKey;
      } else {
        // 이미 디코딩된 상태
        logger.debug("🔑 API 키 이미 디코딩된 상태");
        return rawKey;
      }
    } catch (error) {
      logger.warn("⚠️ API 키 디코딩 실패, 원본 사용:", error.message);
      return rawKey;
    }
  }

  /**
   * 🌫️ 실시간 대기질 현황 조회 (사용자 ID 지원 추가)
   */
  async getCurrentAirQuality(location = "용인시") {
    try {
      // 1️⃣ 위치명 정규화
      const koreanLocation = this.normalizeLocation(location);
      const cacheKey = `current_${koreanLocation}`; // 🔥 빠진 부분!

      // 2️⃣ 캐시 확인
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        logger.info(`📦 대기질 캐시 사용: ${koreanLocation}`);
        return { success: true, data: cached, cached: true, source: "cache" };
      }

      // 3️⃣ API 키 확인
      if (!this.apiKey) {
        logger.warn("⚠️ 대기질 API 키가 설정되지 않음", {
          envVars: {
            AIR_KOREA_API_KEY: !!process.env.AIR_KOREA_API_KEY,
            AIR_QUALITY_API_KEY: !!process.env.AIR_QUALITY_API_KEY,
            DUST_API_KEY: !!process.env.DUST_API_KEY,
          },
        });

        const fallbackData = this.getEstimatedAirQualityData(koreanLocation);
        return {
          success: true,
          data: fallbackData,
          source: "estimated",
          warning:
            "API 키가 설정되지 않아 추정 데이터를 제공합니다. 환경변수 AIR_KOREA_API_KEY를 확인해주세요.",
        };
      }

      // 4️⃣ 여러 측정소 시도
      const stationsToTry = this.fallbackStations[koreanLocation] || [
        koreanLocation,
      ];
      let lastError = null;

      for (const station of stationsToTry) {
        try {
          logger.debug(
            `🔍 측정소 시도: ${station} (API키: ${this.apiKey.substring(
              0,
              10
            )}...)`
          );
          const result = await this.tryGetAirQuality(station);

          if (result.success) {
            // 성공시 캐시 저장
            this.setCache(cacheKey, result.data);
            logger.success(
              `✅ 대기질 조회 성공: ${station} (${koreanLocation} 요청)`
            );

            return {
              ...result,
              originalLocation: koreanLocation, // 🔥 원래 도시명
              actualStation: station, // 실제 측정소명
              location: koreanLocation, // 🔥 표시할 도시명
              source: "api",
            };
          }

          lastError = result.error;
        } catch (error) {
          lastError = error.message;
          logger.debug(`❌ 측정소 ${station} 실패: ${error.message}`);
        }
      }

      // 5️⃣ 모든 측정소 실패시 추정 데이터 제공
      logger.warn(`⚠️ 모든 측정소 실패 (${koreanLocation}), 추정 데이터 제공`, {
        lastError,
        apiKeyStatus: this.apiKey ? "있음" : "없음",
      });

      const estimatedData = this.getEstimatedAirQualityData(koreanLocation);

      return {
        success: true,
        data: estimatedData,
        location: koreanLocation, // 🔥 도시명 유지
        source: "estimated",
        warning: `${koreanLocation} 지역의 실시간 데이터를 가져올 수 없어 추정 데이터를 제공합니다.`,
      };
    } catch (error) {
      logger.error("대기질 조회 전체 실패:", error);

      return {
        success: false,
        error: this.formatError(error),
        data: this.getEstimatedAirQualityData(location),
        location: location, // 🔥 도시명 유지
      };
    }
  }

  /**
   * 💾 사용자 위치 Mongoose 저장
   */
  async saveUserLocationWithMongoose(userId, location) {
    if (!this.checkMongooseConnection()) return;

    try {
      const locationData = {
        userId: userId.toString(),
        location: {
          city: location,
          country: "KR",
          detectedAt: new Date(),
          method: "api_success",
        },
        isActive: true,
        version: 1,
      };

      // Mongoose의 findOneAndUpdate 사용 (upsert)
      await this.UserLocation.findOneAndUpdate(
        { userId: userId.toString() },
        locationData,
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );

      logger.debug(
        `💾 사용자 위치 DB 저장 (Mongoose): ${userId} → ${location}`
      );
    } catch (error) {
      logger.error("❌ 사용자 위치 Mongoose 저장 실패:", error);
    }
  }

  /**
   * 📍 사용자 위치 Mongoose 조회
   */
  async getUserLocationFromMongoose(userId) {
    if (!this.checkMongooseConnection()) return null;

    try {
      const userLocation = await this.UserLocation.findOne({
        userId: userId.toString(),
        isActive: true,
        createdAt: {
          $gte: new Date(Date.now() - 60 * 60 * 1000), // 1시간 이내
        },
      })
        .sort({ createdAt: -1 })
        .select("location createdAt")
        .lean(); // 성능 최적화

      if (userLocation) {
        logger.debug(
          `📦 Mongoose에서 사용자 위치 캐시 사용: ${userLocation.location.city}`
        );
        return userLocation.location;
      }

      return null;
    } catch (error) {
      logger.error("❌ 사용자 위치 Mongoose 조회 실패:", error);
      return null;
    }
  }

  /**
   * 🎯 단일 측정소 API 호출 시도 (에러 처리 강화)
   */
  async tryGetAirQuality(station) {
    const url = `${this.baseUrl}/getMsrstnAcctoRltmMesureDnsty`;

    // ✅ 디코딩된 API 키 직접 사용 (추가 인코딩 없음)
    const params = {
      serviceKey: this.apiKey, // 이미 디코딩된 키 사용
      returnType: "json",
      numOfRows: 1,
      pageNo: 1,
      stationName: station,
      dataTerm: "DAILY",
      ver: "1.0",
    };

    logger.debug(`🌐 대기질 API 요청: ${station}`, {
      url,
      keyPrefix: this.apiKey.substring(0, 10) + "...",
    });

    const response = await axios.get(url, { params, timeout: 10000 });

    // 🔍 응답 분석
    if (!response.data) {
      throw new Error("API 응답이 비어있습니다");
    }

    // XML 에러 응답 처리 (더 구체적)
    if (typeof response.data === "string") {
      if (response.data.includes("SERVICE_KEY_IS_NOT_REGISTERED_ERROR")) {
        throw new Error(
          "❌ API 키가 등록되지 않았습니다.\n\n해결방법:\n1. 공공데이터포털에서 API 키 재발급\n2. 환경변수 AIR_KOREA_API_KEY 확인\n3. 키가 URL 인코딩되어 있다면 디코딩된 키 사용"
        );
      }

      if (response.data.includes("SERVICE ERROR")) {
        throw new Error(
          "API 서비스 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
        );
      }

      if (response.data.includes("OpenAPI_ServiceResponse")) {
        throw new Error("API 응답 형식 오류가 발생했습니다.");
      }
    }

    // JSON 응답 구조 확인
    if (!response.data.response) {
      logger.error("예상과 다른 응답 구조:", {
        dataType: typeof response.data,
        hasResponse: !!response.data.response,
        keys: Object.keys(response.data || {}),
      });
      throw new Error("API 응답 구조가 예상과 다릅니다");
    }

    const header = response.data.response.header;
    if (!header || header.resultCode !== "00") {
      const errorMsg = header?.resultMsg || "알 수 없는 API 오류";
      const resultCode = header?.resultCode || "UNKNOWN";

      // 구체적인 에러 메시지
      if (resultCode === "30") {
        throw new Error(
          "API 키 인증 실패: 키가 등록되지 않았거나 잘못되었습니다."
        );
      } else if (resultCode === "31") {
        throw new Error("API 일일 요청 한도를 초과했습니다.");
      } else {
        throw new Error(`API 오류 (${resultCode}): ${errorMsg}`);
      }
    }

    const items = response.data.response.body?.items;
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error(`측정소 "${station}"의 데이터를 찾을 수 없습니다`);
    }

    // 성공적으로 데이터 획득
    const airData = this.formatAirQualityData(items[0], station);
    return { success: true, data: airData };
  }

  // ===== 기존 메서드들 유지 =====

  /**
   * 🗺️ 위치명 정규화 (영문 → 한글)
   */
  normalizeLocation(location) {
    if (!location) return "화성시";

    const normalized = location.trim();
    return (
      this.locationMapping[normalized] ||
      this.locationMapping[normalized.toLowerCase()] ||
      normalized
    );
  }

  /**
   * 🎨 대기질 데이터 포맷팅
   */
  formatAirQualityData(item, station, originalLocation) {
    // 🔥 originalLocation 추가
    try {
      const pm25Value = this.parseValue(item.pm25Value);
      const pm10Value = this.parseValue(item.pm10Value);
      const pm25Grade = this.parseValue(item.pm25Grade) || 2;
      const pm10Grade = this.parseValue(item.pm10Grade) || 2;

      const pm25Status = this.getGradeStatus(pm25Grade);
      const pm10Status = this.getGradeStatus(pm10Grade);
      const overallGrade = Math.max(pm25Grade, pm10Grade);
      const overallStatus = this.getGradeStatus(overallGrade);

      return {
        station: station, // 실제 측정소명 (인계동)
        location: originalLocation || station, // 🔥 도시명 표시 (수원시)
        displayLocation: originalLocation || station, // 🔥 표시용 위치
        timestamp: TimeHelper.format(TimeHelper.now(), "full"),

        pm25: {
          value: pm25Value,
          grade: pm25Grade,
          status: pm25Status.status,
          emoji: pm25Status.emoji,
          description: pm25Status.description,
        },

        pm10: {
          value: pm10Value,
          grade: pm10Grade,
          status: pm10Status.status,
          emoji: pm10Status.emoji,
          description: pm10Status.description,
        },

        overall: {
          grade: overallStatus.status,
          emoji: overallStatus.emoji,
          description: overallStatus.description,
        },

        others: {
          o3: this.parseValue(item.o3Value),
          no2: this.parseValue(item.no2Value),
          co: this.parseValue(item.coValue),
          so2: this.parseValue(item.so2Value),
          khai: this.parseValue(item.khaiValue),
        },

        advice: this.generateAirQualityAdvice(
          overallGrade,
          pm25Grade,
          pm10Grade
        ),
        summary: this.createAirQualitySummary(
          station,
          overallStatus,
          pm25Status,
          pm10Status
        ),

        meta: {
          source: "한국환경공단",
          apiResponse: true,
          hasRealData: true,
          lastUpdate: TimeHelper.format(TimeHelper.now(), "time"),
        },
      };
    } catch (error) {
      // 에러 처리
      // logger.error("대기질 데이터 포맷팅 실패:", error);
      // return this.getEstimatedAirQualityData(station);
    }
  }

  /**
   * 🌟 추정 대기질 데이터 생성 (시간대별 패턴)
   */
  getEstimatedAirQualityData(location) {
    // 현재 시간대별 추정값
    const hour = new Date().getHours();
    let basePM25, basePM10;

    // 시간대별 대기질 패턴
    if (hour >= 7 && hour <= 9) {
      // 출근시간 - 나쁨
      basePM25 = 40;
      basePM10 = 70;
    } else if (hour >= 18 && hour <= 20) {
      // 퇴근시간 - 나쁨
      basePM25 = 38;
      basePM10 = 65;
    } else if (hour >= 22 || hour <= 6) {
      // 새벽/밤 - 좋음
      basePM25 = 15;
      basePM10 = 25;
    } else {
      // 일반시간 - 보통
      basePM25 = 25;
      basePM10 = 45;
    }

    // 지역별 보정
    if (
      location.includes("화성") ||
      location.includes("용인") ||
      location.includes("수원")
    ) {
      basePM25 += 5;
      basePM10 += 8;
    }

    const pm25Grade =
      basePM25 <= 15 ? 1 : basePM25 <= 35 ? 2 : basePM25 <= 75 ? 3 : 4;
    const pm10Grade =
      basePM10 <= 30 ? 1 : basePM10 <= 80 ? 2 : basePM10 <= 150 ? 3 : 4;

    const pm25Status = this.getGradeStatus(pm25Grade);
    const pm10Status = this.getGradeStatus(pm10Grade);
    const overallGrade = Math.max(pm25Grade, pm10Grade);
    const overallStatus = this.getGradeStatus(overallGrade);

    return {
      station: location,
      location: location,
      timestamp: TimeHelper.format(TimeHelper.now(), "full"),

      pm25: {
        value: basePM25,
        grade: pm25Grade,
        status: pm25Status.status,
        emoji: pm25Status.emoji,
        description: pm25Status.description,
      },

      pm10: {
        value: basePM10,
        grade: pm10Grade,
        status: pm10Status.status,
        emoji: pm10Status.emoji,
        description: pm10Status.description,
      },

      overall: {
        grade: overallStatus.status,
        emoji: overallStatus.emoji,
        description: overallStatus.description,
      },

      others: {
        o3: null,
        no2: null,
        co: null,
        so2: null,
        khai: null,
      },

      advice: this.generateAirQualityAdvice(overallGrade, pm25Grade, pm10Grade),
      summary: this.createAirQualitySummary(
        location,
        overallStatus,
        pm25Status,
        pm10Status
      ),

      meta: {
        source: "추정데이터",
        apiResponse: false,
        hasRealData: false,
        lastUpdate: TimeHelper.format(TimeHelper.now(), "time"),
        pattern: "시간대별 패턴 기반",
      },
    };
  }

  getGradeStatus(grade) {
    const statusMap = {
      1: { status: "좋음", emoji: "😊", description: "대기질이 좋아요" },
      2: { status: "보통", emoji: "😐", description: "보통 수준이에요" },
      3: {
        status: "나쁨",
        emoji: "😷",
        description: "외출시 마스크 착용하세요",
      },
      4: {
        status: "매우나쁨",
        emoji: "🤢",
        description: "외출을 자제해주세요",
      },
    };

    return statusMap[grade] || statusMap[2];
  }

  parseValue(value) {
    if (!value || value === "-" || value === "null") return null;
    const parsed = parseInt(value);
    return isNaN(parsed) ? null : parsed;
  }

  generateAirQualityAdvice(overallGrade, pm25Grade, pm10Grade) {
    const adviceMap = {
      1: ["실외 활동하기 좋은 날입니다", "창문을 열어 환기해보세요"],
      2: [
        "일반적인 실외 활동 가능합니다",
        "민감한 분은 마스크 착용을 권합니다",
      ],
      3: ["마스크 착용을 권장합니다", "실외 활동을 줄이고 실내에 머무세요"],
      4: [
        "외출을 자제해주세요",
        "실내 공기청정기를 가동하세요",
        "창문을 닫아주세요",
      ],
    };

    return adviceMap[overallGrade] || adviceMap[2];
  }

  createAirQualitySummary(station, overall, pm25, pm10) {
    let summary = `${overall.emoji} ${station} 대기질: ${overall.status}`;

    if (pm25.status === pm10.status) {
      summary += `\n초미세먼지와 미세먼지 모두 '${pm25.status}' 수준입니다.`;
    } else {
      summary += `\n초미세먼지: ${pm25.status}, 미세먼지: ${pm10.status}`;
    }

    return summary;
  }

  // 캐시 관리
  setCache(key, data, timeout = this.cacheTimeout) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      timeout,
    });
  }

  getFromCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > cached.timeout) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  clearCache() {
    this.cache.clear();
    logger.info("대기질 캐시 초기화");
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  formatError(error) {
    if (error.response) {
      const status = error.response.status;
      switch (status) {
        case 401:
          return "대기질 API 키가 유효하지 않습니다.";
        case 404:
          return "측정소를 찾을 수 없습니다.";
        case 429:
          return "API 요청 한도를 초과했습니다.";
        default:
          return `대기질 정보를 가져올 수 없습니다: ${error.message}`;
      }
    }
    return "대기질 서비스에 일시적인 문제가 발생했습니다.";
  }

  async checkStatus() {
    try {
      if (!this.apiKey) {
        return {
          status: "warning",
          message: "API 키 없음 - 추정 데이터 제공 중",
          hasApiKey: false,
          canProvideData: true,
          instructions:
            "환경변수 AIR_KOREA_API_KEY를 설정하면 실제 데이터를 사용할 수 있습니다.",
        };
      }

      const result = await this.getCurrentAirQuality("화성시");

      return {
        status: result.success ? "ok" : "warning",
        message: result.success ? "정상 작동" : result.warning || result.error,
        apiKey: "설정됨",
        cacheSize: this.cache.size,
        canProvideData: true,
        dataSource: result.source || "unknown",
        hasMongoose: this.checkMongooseConnection(),
      };
    } catch (error) {
      return {
        status: "warning",
        message: "추정 데이터로 서비스 중",
        apiKey: this.apiKey ? "설정됨" : "없음",
        canProvideData: true,
        error: error.message,
      };
    }
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    try {
      this.clearCache();
      logger.info("✅ AirQualityHelper 정리 완료");
    } catch (error) {
      logger.error("❌ AirQualityHelper 정리 실패:", error);
    }
  }
}

module.exports = AirQualityHelper;
