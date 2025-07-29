// src/utils/AirQualityHelper.js - API 키 디코딩 처리 추가

const BaseService = require("../core/BaseModule");
const axios = require("axios");
const logger = require("./Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🌬️ AirQualityHelper - API 키 디코딩 처리 버전
 *
 * 🔧 추가 수정사항:
 * - API 키 URL 디코딩 처리
 * - 인코딩된 키와 디코딩된 키 자동 감지
 * - 더 나은 에러 메시지
 */
class AirQualityHelper extends BaseService {
  constructor() {
    super();

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

    // 캐시 설정
    this.cache = new Map();
    this.cacheTimeout = 60 * 60 * 1000; // 1시간

    // 🗺️ 지역별 측정소 매핑 (영문 → 한글)
    this.locationMapping = {
      // 경기도 주요 도시
      "Yongin-si": "용인시",
      Yongin: "용인시",
      용인시: "용인시",
      용인: "용인시",

      // 주요 도시들
      Seoul: "서울",
      서울: "서울",
      Busan: "부산",
      부산: "부산",
      Daegu: "대구",
      대구: "대구",
      Incheon: "인천",
      인천: "인천",
      Gwangju: "광주",
      광주: "광주",
      Daejeon: "대전",
      대전: "대전",
      Ulsan: "울산",
      울산: "울산",

      // 경기도
      Suwon: "수원",
      수원: "수원",
      Goyang: "고양시",
      고양시: "고양시",
      Seongnam: "성남시",
      성남시: "성남시",
      Hwaseong: "화성시",
      화성시: "화성시",
      "Hwaseong-si": "화성시",

      // 기본값
      화성: "화성시",
    };

    // 🎯 지역별 대체 측정소 (첫 번째가 실패하면 순서대로 시도)
    this.fallbackStations = {
      용인시: ["용인시", "수원", "성남시", "화성시"],
      화성시: ["화성시", "수원", "용인시", "안산"],
      서울: ["서울", "종로구", "중구", "강남구"],
      부산: ["부산", "중구", "해운대구"],
      대구: ["대구", "중구", "수성구"],
      인천: ["인천", "연수구", "남동구"],
      광주: ["광주", "서구", "북구"],
      대전: ["대전", "서구", "유성구"],
      울산: ["울산", "남구", "중구"],
    };
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
   * 🌫️ 실시간 대기질 현황 조회 (API 키 처리 개선)
   */
  async getCurrentAirQuality(location = "용인시") {
    try {
      // 1️⃣ 위치명 정규화
      const koreanLocation = this.normalizeLocation(location);
      const cacheKey = `current_${koreanLocation}`;

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
          success: true, // 폴백이지만 데이터는 제공
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
              originalLocation: koreanLocation,
              actualStation: station,
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
        success: true, // 추정이지만 데이터는 제공
        data: estimatedData,
        source: "estimated",
        originalLocation: koreanLocation,
        warning: `${koreanLocation} 지역의 실시간 데이터를 가져올 수 없어 추정 데이터를 제공합니다. API 키나 측정소명을 확인해주세요.`,
      };
    } catch (error) {
      logger.error("대기질 조회 전체 실패:", error);

      return {
        success: false,
        error: this.formatError(error),
        data: this.getEstimatedAirQualityData(location),
      };
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
    if (!location) return "용인시";

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
  formatAirQualityData(item, station) {
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
        station: station,
        location: station,
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
      logger.error("대기질 데이터 포맷팅 실패:", error);
      return this.getEstimatedAirQualityData(station);
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
      // 출근시간 - 약간 나쁨
      basePM25 = 30 + Math.random() * 15;
      basePM10 = 50 + Math.random() * 20;
    } else if (hour >= 18 && hour <= 20) {
      // 퇴근시간 - 약간 나쁨
      basePM25 = 28 + Math.random() * 17;
      basePM10 = 48 + Math.random() * 22;
    } else if (hour >= 11 && hour <= 15) {
      // 낮시간 - 보통
      basePM25 = 20 + Math.random() * 15;
      basePM10 = 35 + Math.random() * 25;
    } else {
      // 기타 시간 - 좋음~보통
      basePM25 = 15 + Math.random() * 15;
      basePM10 = 30 + Math.random() * 20;
    }

    const pm25Value = Math.round(basePM25);
    const pm10Value = Math.round(basePM10);

    const pm25Grade = this.calculateGradeFromValue(pm25Value, "pm25");
    const pm10Grade = this.calculateGradeFromValue(pm10Value, "pm10");
    const overallGrade = Math.max(pm25Grade, pm10Grade);

    const pm25Status = this.getGradeStatus(pm25Grade);
    const pm10Status = this.getGradeStatus(pm10Grade);
    const overallStatus = this.getGradeStatus(overallGrade);

    return {
      station: location,
      location: location,
      timestamp: TimeHelper.format(TimeHelper.now(), "full"),

      pm25: {
        value: pm25Value,
        grade: pm25Grade,
        status: pm25Status.status + " (추정)",
        emoji: pm25Status.emoji,
        description: pm25Status.description + " (추정치)",
      },

      pm10: {
        value: pm10Value,
        grade: pm10Grade,
        status: pm10Status.status + " (추정)",
        emoji: pm10Status.emoji,
        description: pm10Status.description + " (추정치)",
      },

      overall: {
        grade: overallStatus.status + " (추정)",
        emoji: overallStatus.emoji,
        description: overallStatus.description + " (추정치)",
      },

      others: {
        o3: Math.round((0.03 + Math.random() * 0.05) * 1000) / 1000,
        no2: Math.round((0.02 + Math.random() * 0.03) * 1000) / 1000,
        co: Math.round((0.5 + Math.random() * 0.8) * 10) / 10,
        so2: Math.round((0.003 + Math.random() * 0.007) * 1000) / 1000,
        khai: Math.round(50 + Math.random() * 40),
      },

      advice:
        this.generateAirQualityAdvice(overallGrade, pm25Grade, pm10Grade) +
        " (※ 추정 데이터이므로 참고용으로만 사용하세요)",

      summary:
        `🔮 ${location} 추정 대기질: ${overallStatus.status}\n` +
        `시간대별 패턴을 고려한 추정치입니다.`,

      meta: {
        source: "추정 데이터",
        apiResponse: false,
        hasRealData: false,
        lastUpdate: TimeHelper.format(TimeHelper.now(), "time"),
        isEstimated: true,
      },
    };
  }

  // ===== 유틸리티 메서드들 =====

  calculateGradeFromValue(value, type) {
    if (type === "pm25") {
      if (value <= 15) return 1;
      if (value <= 35) return 2;
      if (value <= 75) return 3;
      return 4;
    } else {
      if (value <= 30) return 1;
      if (value <= 80) return 2;
      if (value <= 150) return 3;
      return 4;
    }
  }

  parseValue(value) {
    if (
      value === null ||
      value === undefined ||
      value === "" ||
      value === "-"
    ) {
      return null;
    }
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }

  getGradeStatus(grade) {
    const gradeNum = parseInt(grade) || 2;
    const gradeMap = {
      1: {
        status: "좋음",
        emoji: "😊",
        description: "대기질이 좋아 외출하기 좋습니다",
      },
      2: {
        status: "보통",
        emoji: "😐",
        description: "일반적인 야외활동이 가능합니다",
      },
      3: {
        status: "나쁨",
        emoji: "😷",
        description: "마스크 착용을 권장합니다",
      },
      4: {
        status: "매우나쁨",
        emoji: "😨",
        description: "외출을 자제하고 실내 활동을 권장합니다",
      },
    };
    return gradeMap[gradeNum] || gradeMap[2];
  }

  generateAirQualityAdvice(overallGrade, pm25Grade, pm10Grade) {
    const advice = [];

    if (overallGrade >= 4) {
      advice.push("외출을 최대한 자제해주세요");
      advice.push("실내에서도 공기청정기를 사용하세요");
    } else if (overallGrade >= 3) {
      advice.push("외출시 마스크를 반드시 착용하세요");
      advice.push("야외 운동을 피하고 실내 활동을 권장합니다");
    } else if (overallGrade >= 2) {
      advice.push("일반적인 야외활동이 가능합니다");
      advice.push("민감한 분들은 마스크 착용을 고려하세요");
    } else {
      advice.push("대기질이 좋아 외출하기 좋은 날입니다");
      advice.push("야외 활동을 즐기세요");
    }

    return advice.join(". ") + ".";
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

      const result = await this.getCurrentAirQuality("용인시");

      return {
        status: result.success ? "ok" : "warning",
        message: result.success ? "정상 작동" : result.warning || result.error,
        apiKey: "설정됨",
        cacheSize: this.cache.size,
        canProvideData: true,
        dataSource: result.source || "unknown",
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
}

module.exports = AirQualityHelper;
