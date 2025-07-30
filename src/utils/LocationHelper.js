// src/utils/LocationHelper.js - Railway 환경 대응 수정

const axios = require("axios");
const logger = require("./Logger");

/**
 * 📍 LocationHelper - GPS 및 카카오맵 기반 위치 감지
 */
class LocationHelper {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10분
    this.kakaoApiKey = process.env.KAKAO_API_KEY;

    // Railway 환경 확인
    this.isRailway = !!process.env.RAILWAY_ENVIRONMENT;
    this.isProduction = process.env.NODE_ENV === "production";

    // 환경변수에서 기본 위치 설정
    this.defaultLocation = process.env.DEFAULT_LOCATION || "화성시";
    this.defaultRegion = process.env.DEFAULT_REGION || "경기도";

    // IP 기반 위치 서비스 URL들
    this.ipServices = [
      "https://ipapi.co/json/",
      "http://ip-api.com/json/",
      "https://ipinfo.io/json",
    ];

    logger.info("📍 LocationHelper 초기화", {
      hasKakaoKey: !!this.kakaoApiKey,
      isRailway: this.isRailway,
      defaultLocation: this.defaultLocation,
      cacheTimeout: this.cacheTimeout,
    });
  }

  /**
   * 🎯 자동 위치 감지 - 사용자별 저장된 위치 우선
   */
  async detectLocation(userId, userPreferredLocation = null) {
    try {
      // 1. 사용자가 명시적으로 설정한 위치가 있으면 우선 사용
      if (userPreferredLocation) {
        logger.info(`📍 사용자 설정 위치 사용: ${userPreferredLocation}`);
        return this.parseUserLocation(userPreferredLocation);
      }

      // 2. 캐시 확인
      const cached = this.getCache(userId);
      if (cached) {
        logger.info(
          `📦 캐시된 위치 사용: ${cached.city} ${cached.district || ""}`
        );
        return cached;
      }

      // 3. Railway 프로덕션 환경에서는 IP 감지 스킵하고 기본값 사용
      if (this.isRailway && this.isProduction) {
        logger.info(
          `🚂 Railway 환경 - 기본 위치 사용: ${this.defaultLocation}`
        );
        return this.getDefaultLocation();
      }

      // 4. 개발 환경에서만 IP 기반 위치 감지
      try {
        const location = await this.detectByIP();
        if (location && location.city && location.city !== "Singapore") {
          logger.info(`📡 IP 위치 감지 성공: ${location.city}`);
          this.setCache(userId, location);
          return location;
        }
      } catch (error) {
        logger.warn("IP 위치 감지 실패:", error.message);
      }

      // 5. 기본값 사용
      logger.info(`📌 기본 위치 사용: ${this.defaultLocation}`);
      return this.getDefaultLocation();
    } catch (error) {
      logger.error("위치 감지 전체 실패:", error);
      return this.getDefaultLocation();
    }
  }

  /**
   * 📍 사용자 입력 위치 파싱
   */
  parseUserLocation(location) {
    const normalized = this.normalizeLocationName(location);

    return {
      city: normalized,
      simpleCity: normalized.split(" ")[0],
      district: "",
      fullAddress: normalized,
      region: this.getRegionByCity(normalized),
      country: "KR",
      confidence: 1.0,
      method: "user_input",
      timestamp: new Date(),
    };
  }

  /**
   * 🏷️ 위치명 정규화
   */
  normalizeLocationName(location) {
    let normalized = location.trim();

    // "시" 추가 (필요한 경우)
    if (
      !normalized.endsWith("시") &&
      !normalized.includes("구") &&
      !normalized.includes("동")
    ) {
      const needsSi = ["서울", "부산", "대구", "인천", "광주", "대전", "울산"];
      if (!needsSi.includes(normalized)) {
        normalized += "시";
      }
    }

    return normalized;
  }

  /**
   * 🌐 IP 기반 위치 감지 (개선됨)
   */
  async detectByIP() {
    // Railway 환경에서는 스킵
    if (this.isRailway) {
      logger.debug("Railway 환경에서 IP 감지 스킵");
      return null;
    }

    for (const serviceUrl of this.ipServices) {
      try {
        logger.debug(`IP 서비스 시도: ${serviceUrl}`);

        const response = await axios.get(serviceUrl, {
          timeout: 3000,
          headers: { "User-Agent": "DoomockBot/1.0" },
        });

        const data = response.data;

        // 각 서비스별 응답 형식 처리
        if (serviceUrl.includes("ipapi.co")) {
          if (data.city && data.country === "KR") {
            const cityName = data.city;
            const regionName = data.region;

            // 싱가포르나 외국 도시는 무시
            if (cityName === "Singapore" || data.country !== "KR") {
              logger.debug("외국 IP 감지됨, 스킵");
              continue;
            }

            const cityMap = {
              Seoul: "서울",
              Busan: "부산",
              Daegu: "대구",
              Incheon: "인천",
              Gwangju: "광주",
              Daejeon: "대전",
              Ulsan: "울산",
              Suwon: "수원시",
              "Suwon-si": "수원시",
              Yongin: "용인시",
              "Yongin-si": "용인시",
              Seongnam: "성남시",
              "Seongnam-si": "성남시",
              Hwaseong: "화성시",
              "Hwaseong-si": "화성시",
              Anyang: "안양시",
              "Anyang-si": "안양시",
              Yangju: "양주시",
              "Yangju-si": "양주시",
            };

            const city = cityMap[cityName] || cityName;

            return {
              city: city,
              simpleCity: city,
              district: "",
              fullAddress: city,
              region: regionName || this.getRegionByCity(city),
              country: "KR",
              lat: data.latitude || 37.5665,
              lon: data.longitude || 126.978,
              confidence: 0.6,
              method: "ip_detection",
              timestamp: new Date(),
            };
          }
        } else if (serviceUrl.includes("ip-api.com")) {
          if (data.status === "success" && data.countryCode === "KR") {
            // 비슷한 처리...
            if (data.city === "Singapore") continue;

            return {
              city: data.city,
              simpleCity: data.city,
              district: "",
              fullAddress: data.city,
              region: data.regionName || this.getRegionByCity(data.city),
              country: "KR",
              lat: data.lat,
              lon: data.lon,
              confidence: 0.6,
              method: "ip_detection",
              timestamp: new Date(),
            };
          }
        }
      } catch (error) {
        logger.debug(`IP 서비스 실패 (${serviceUrl}):`, error.message);
        continue;
      }
    }

    return null;
  }

  /**
   * 🗺️ 도시명으로 지역(도) 추정
   */
  getRegionByCity(city) {
    const regionMap = {
      서울: "서울특별시",
      부산: "부산광역시",
      대구: "대구광역시",
      인천: "인천광역시",
      광주: "광주광역시",
      대전: "대전광역시",
      울산: "울산광역시",
      세종: "세종특별자치시",
      // 경기도
      수원시: "경기도",
      용인시: "경기도",
      성남시: "경기도",
      화성시: "경기도",
      안양시: "경기도",
      안산시: "경기도",
      부천시: "경기도",
      평택시: "경기도",
      의정부시: "경기도",
      고양시: "경기도",
      남양주시: "경기도",
      파주시: "경기도",
      김포시: "경기도",
      광명시: "경기도",
      군포시: "경기도",
      하남시: "경기도",
      오산시: "경기도",
      이천시: "경기도",
      안성시: "경기도",
      의왕시: "경기도",
      양평군: "경기도",
      여주시: "경기도",
      과천시: "경기도",
      // 다른 지역들...
    };

    return regionMap[city] || this.defaultRegion;
  }

  /**
   * 🏠 기본 위치 (환경변수 기반)
   */
  getDefaultLocation() {
    const defaultCity = this.defaultLocation;
    const defaultRegion = this.getRegionByCity(defaultCity);

    // 주요 도시별 좌표
    const cityCoordinates = {
      서울: { lat: 37.5665, lon: 126.978 },
      수원시: { lat: 37.2636, lon: 127.0286 },
      용인시: { lat: 37.2411, lon: 127.1775 },
      성남시: { lat: 37.42, lon: 127.1267 },
      화성시: { lat: 37.2063, lon: 127.0728 },
      안양시: { lat: 37.3943, lon: 126.9568 },
      부천시: { lat: 37.5037, lon: 126.766 },
      평택시: { lat: 36.9921, lon: 127.1125 },
      안산시: { lat: 37.3219, lon: 126.8309 },
    };

    const coords = cityCoordinates[defaultCity] || {
      lat: 37.2063,
      lon: 127.0728,
    };

    return {
      city: defaultCity,
      simpleCity: defaultCity,
      district: "",
      fullAddress: defaultCity,
      region: defaultRegion,
      country: "KR",
      lat: coords.lat,
      lon: coords.lon,
      confidence: 0.3,
      method: "default",
      timestamp: new Date(),
    };
  }

  /**
   * 📦 캐시 관리
   */
  getCache(userId) {
    const cached = this.cache.get(`location_${userId}`);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return {
        ...cached.data,
        method: "cache",
      };
    }
    this.cache.delete(`location_${userId}`);
    return null;
  }

  setCache(userId, location) {
    this.cache.set(`location_${userId}`, {
      data: location,
      timestamp: Date.now(),
    });
  }

  /**
   * 🧹 캐시 정리
   */
  clearCache(userId = null) {
    if (userId) {
      this.cache.delete(`location_${userId}`);
    } else {
      this.cache.clear();
    }
    logger.info("📦 위치 캐시 정리됨");
  }

  /**
   * 📊 캐시 상태
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      timeout: this.cacheTimeout,
      isRailway: this.isRailway,
      defaultLocation: this.defaultLocation,
    };
  }
}

module.exports = LocationHelper;
