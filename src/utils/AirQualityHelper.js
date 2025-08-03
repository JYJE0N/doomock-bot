// src/utils/AirQualityHelper.js - 미세먼지 정보 개선

const axios = require("axios");
const logger = require("./Logger");
const TimeHelper = require("./TimeHelper");

/**
 * 🌬️ AirQualityHelper - 대기질/미세먼지 정보 제공
 */
class AirQualityHelper {
  constructor() {
    // API 설정 - 디코딩된 키 직접 사용
    this.apiKey = process.env.AIR_KOREA_API_KEY || process.env.DATA_GO_KR_API_KEY;
    this.baseUrl = "http://apis.data.go.kr/B552584/ArpltnInforInqireSvc";

    // 캐시 설정
    this.cache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10분

    // 측정소 매핑
    this.stationMapping = this.initializeStationMapping();

    // 통계
    this.stats = {
      apiCalls: 0,
      cacheHits: 0,
      errors: 0,
      lastUpdate: null
    };

    logger.info("🌬️ AirQualityHelper 초기화", {
      hasApiKey: !!this.apiKey,
      keyLength: this.apiKey ? this.apiKey.length : 0
    });
  }

  /**
   * 🗺️ 측정소 매핑 초기화
   */
  initializeStationMapping() {
    return {
      // 서울
      서울: "종로구",
      서울특별시: "종로구",
      Seoul: "종로구",

      // 경기도 주요 도시
      수원시: "인계동",
      용인시: "김량장동",
      "용인시 수지구": "수지",
      "용인시 기흥구": "기흥",
      "용인시 처인구": "김량장동",
      성남시: "수정구",
      "성남시 분당구": "분당구",
      안양시: "안양시",
      부천시: "부천시",
      화성시: "동탄",
      "화성시 동탄": "동탄",
      평택시: "평택시",
      안산시: "안산시",
      고양시: "고양시",
      의정부시: "의정부시",
      남양주시: "남양주시",
      파주시: "파주시",

      // 기타 광역시
      부산: "광복동",
      부산광역시: "광복동",
      대구: "수창동",
      대구광역시: "수창동",
      인천: "구월동",
      인천광역시: "구월동",
      광주: "농성동",
      광주광역시: "농성동",
      대전: "문창동",
      대전광역시: "문창동",
      울산: "삼산동",
      울산광역시: "삼산동"
    };
  }

  /**
   * 🌫️ 실시간 대기질 조회
   */
  async getCurrentAirQuality(location = "화성시") {
    try {
      this.stats.apiCalls++;

      // 위치명 정규화
      const normalizedLocation = this.normalizeLocation(location);

      // 캐시 확인
      const cacheKey = `airquality_${normalizedLocation}`;
      const cached = this.getCache(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        logger.info(`📦 캐시된 미세먼지 데이터 사용: ${normalizedLocation}`);
        return {
          success: true,
          data: cached,
          location: normalizedLocation,
          source: "cache"
        };
      }

      // API 호출
      if (!this.apiKey) {
        logger.warn("⚠️ 대기질 API 키가 없습니다. 추정 데이터 제공");
        return this.getEstimatedData(normalizedLocation);
      }

      const stationName = this.getStationName(normalizedLocation);
      const data = await this.fetchAirQualityData(stationName);

      if (data) {
        // 캐시 저장
        this.setCache(cacheKey, data);
        this.stats.lastUpdate = new Date();

        return {
          success: true,
          data: data,
          location: normalizedLocation,
          source: "api"
        };
      } else {
        // API 실패 시 추정 데이터
        return this.getEstimatedData(normalizedLocation);
      }
    } catch (error) {
      this.stats.errors++;
      logger.error("대기질 조회 실패:", error);
      return this.getEstimatedData(location);
    }
  }

  /**
   * 🔌 API 호출
   */
  async fetchAirQualityData(stationName) {
    try {
      const url = `${this.baseUrl}/getMsrstnAcctoRltmMesureDnsty`;

      const response = await axios.get(url, {
        params: {
          serviceKey: this.apiKey, // 이미 디코딩된 키 사용
          returnType: "json",
          numOfRows: 1,
          pageNo: 1,
          stationName: stationName,
          dataTerm: "DAILY",
          ver: "1.0"
        },
        timeout: 5000
      });

      if (response.data?.response?.body?.items?.[0]) {
        const item = response.data.response.body.items[0];

        return {
          pm25: {
            value: item.pm25Value || "-",
            grade: this.getGrade(item.pm25Grade),
            flag: item.pm25Flag
          },
          pm10: {
            value: item.pm10Value || "-",
            grade: this.getGrade(item.pm10Grade),
            flag: item.pm10Flag
          },
          overall: {
            value: item.khaiValue || "-",
            grade: this.getGrade(item.khaiGrade)
          },
          o3: {
            value: item.o3Value || "-",
            grade: this.getGrade(item.o3Grade)
          },
          no2: {
            value: item.no2Value || "-",
            grade: this.getGrade(item.no2Grade)
          },
          co: {
            value: item.coValue || "-",
            grade: this.getGrade(item.coGrade)
          },
          so2: {
            value: item.so2Value || "-",
            grade: this.getGrade(item.so2Grade)
          },
          stationName: stationName,
          dataTime: item.dataTime,
          timestamp: TimeHelper.format(item.dataTime, "time")
        };
      }

      return null;
    } catch (error) {
      logger.error(`API 호출 실패 (${stationName}):`, error.message);
      return null;
    }
  }

  /**
   * 🎯 추정 데이터 제공
   */
  getEstimatedData(location) {
    // 시간대별 추정값
    const hour = new Date().getHours();
    let pm25Base, pm10Base;

    if (hour >= 7 && hour <= 9) {
      // 출근 시간
      pm25Base = 35;
      pm10Base = 65;
    } else if (hour >= 18 && hour <= 20) {
      // 퇴근 시간
      pm25Base = 40;
      pm10Base = 70;
    } else if (hour >= 0 && hour <= 6) {
      // 새벽
      pm25Base = 20;
      pm10Base = 35;
    } else {
      // 평시
      pm25Base = 25;
      pm10Base = 45;
    }

    // 약간의 변동 추가
    const variation = Math.random() * 10 - 5;
    const pm25Value = Math.round(pm25Base + variation);
    const pm10Value = Math.round(pm10Base + variation * 1.5);

    const data = {
      pm25: {
        value: pm25Value.toString(),
        grade: this.getDustGrade(pm25Value, "pm25")
      },
      pm10: {
        value: pm10Value.toString(),
        grade: this.getDustGrade(pm10Value, "pm10")
      },
      overall: {
        grade: this.getDustGrade(Math.max(pm25Value, pm10Value), "overall"),
        value: Math.round((pm25Value + pm10Value) / 2).toString()
      },
      advice: this.getDustAdvice(this.getDustGrade(Math.max(pm25Value, pm10Value), "overall")),
      timestamp: TimeHelper.format(TimeHelper.now(), "time"),
      stationName: "추정값",
      dataTime: TimeHelper.format(TimeHelper.now(), "full")
    };

    logger.info(`📊 추정 미세먼지 데이터 생성: ${location}`);

    return {
      success: true,
      data: data,
      location: location,
      source: "estimated",
      warning: "실시간 데이터를 가져올 수 없어 추정값을 제공합니다"
    };
  }

  /**
   * 🏷️ 위치명 정규화
   */
  normalizeLocation(location) {
    if (!location) return "화성시";

    // "시", "구" 등 제거
    let normalized = location.trim();

    // 특별시/광역시 처리
    if (normalized.includes("특별시") || normalized.includes("광역시")) {
      normalized = normalized.replace(/특별시|광역시/g, "");
    }

    return normalized;
  }

  /**
   * 🏢 측정소명 조회
   */
  getStationName(location) {
    return this.stationMapping[location] || this.stationMapping[location.replace(/시$/, "")] || "종로구"; // 기본값
  }

  /**
   * 🎯 등급 변환
   */
  getGrade(gradeValue) {
    const gradeMap = {
      1: "좋음",
      2: "보통",
      3: "나쁨",
      4: "매우나쁨"
    };
    return gradeMap[gradeValue] || "알 수 없음";
  }

  /**
   * 🎯 미세먼지 등급 판정
   */
  getDustGrade(value, type) {
    const numValue = parseInt(value);
    if (isNaN(numValue)) return "알 수 없음";

    if (type === "pm25") {
      if (numValue <= 15) return "좋음";
      if (numValue <= 35) return "보통";
      if (numValue <= 75) return "나쁨";
      return "매우나쁨";
    } else if (type === "pm10") {
      if (numValue <= 30) return "좋음";
      if (numValue <= 80) return "보통";
      if (numValue <= 150) return "나쁨";
      return "매우나쁨";
    } else {
      // overall
      if (numValue <= 50) return "좋음";
      if (numValue <= 100) return "보통";
      if (numValue <= 250) return "나쁨";
      return "매우나쁨";
    }
  }

  /**
   * 💡 행동요령 제공
   */
  getDustAdvice(grade) {
    const adviceMap = {
      좋음: "외출하기 좋은 날씨입니다! 야외활동을 즐기세요.",
      보통: "일반적인 야외활동에 지장이 없습니다.",
      나쁨: "장시간 야외활동을 자제하고, 외출 시 마스크를 착용하세요.",
      매우나쁨: "외출을 자제하고, 부득이한 외출 시 보건용 마스크를 착용하세요."
    };
    return adviceMap[grade] || "대기질 정보를 확인하세요.";
  }

  /**
   * 📦 캐시 관리
   */
  getCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.cache.clear();
    logger.info("📦 대기질 캐시 정리됨");
  }

  /**
   * 📊 통계 정보
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      lastUpdate: this.stats.lastUpdate ? TimeHelper.format(this.stats.lastUpdate, "full") : "없음"
    };
  }
}

module.exports = AirQualityHelper;
