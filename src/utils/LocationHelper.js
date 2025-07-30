// src/utils/LocationHelper.js - 진짜 GPS 기반 위치 감지!

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
    this.defaultLocation = process.env.DEFAULT_LOCATION || "수원시"; // 기본 도시 수원시로 변경
    this.defaultRegion = process.env.DEFAULT_REGION || "경기도";

    logger.info("📍 LocationHelper 초기화", {
      hasKakaoKey: !!this.kakaoApiKey,
      isRailway: this.isRailway,
      defaultLocation: this.defaultLocation,
    });
  }

  /**
   * 🎯 GPS 좌표로 주소 변환 (카카오 역지오코딩)
   */
  async getAddressFromGPS(latitude, longitude) {
    if (!this.kakaoApiKey) {
      logger.warn("카카오 API 키가 없어 주소 변환 불가");
      return this.estimateLocationFromCoords(latitude, longitude);
    }

    try {
      const response = await axios.get(
        "https://dapi.kakao.com/v2/local/geo/coord2address.json",
        {
          params: {
            x: longitude,
            y: latitude,
            input_coord: "WGS84",
          },
          headers: {
            Authorization: `KakaoAK ${this.kakaoApiKey}`,
          },
          timeout: 5000,
        }
      );

      if (response.data.documents && response.data.documents.length > 0) {
        const doc = response.data.documents[0];
        const address = doc.address || doc.road_address;

        if (address) {
          const city = this.extractCityFromAddress(address);
          const district = address.region_3depth_name || "";

          logger.info(`📍 GPS 주소 변환 성공: ${city} ${district}`);

          return {
            city: city,
            simpleCity: city.replace("시", ""),
            district: district,
            fullAddress: address.address_name,
            region: address.region_1depth_name,
            country: "KR",
            lat: latitude,
            lon: longitude,
            confidence: 1.0,
            method: "gps_kakao",
            timestamp: new Date(),
          };
        }
      }

      // 카카오 API 실패 시 좌표 기반 추정
      return this.estimateLocationFromCoords(latitude, longitude);
    } catch (error) {
      logger.error("카카오 역지오코딩 실패:", error.message);
      return this.estimateLocationFromCoords(latitude, longitude);
    }
  }

  /**
   * 🗺️ 주소에서 도시명 추출
   */
  extractCityFromAddress(address) {
    // 카카오 주소 형식에서 도시명 추출
    if (address.region_2depth_name) {
      return address.region_2depth_name;
    }

    // 주소 문자열에서 추출
    const addressStr = address.address_name || "";
    const parts = addressStr.split(" ");

    // 광역시인 경우
    if (parts[0] && parts[0].includes("광역시")) {
      return parts[0].replace("광역시", "");
    }

    // 일반 시인 경우
    if (parts[1] && parts[1].includes("시")) {
      return parts[1];
    }

    return this.defaultLocation;
  }

  /**
   * 📍 좌표 기반 도시 추정 (카카오 API 없을 때 백업)
   */
  estimateLocationFromCoords(latitude, longitude) {
    // 주요 도시별 대략적인 좌표 범위
    const cityRanges = [
      {
        city: "서울",
        region: "서울특별시",
        minLat: 37.4,
        maxLat: 37.7,
        minLon: 126.8,
        maxLon: 127.2,
      },
      {
        city: "수원시",
        region: "경기도",
        minLat: 37.2,
        maxLat: 37.35,
        minLon: 126.9,
        maxLon: 127.1,
      },
      {
        city: "용인시",
        region: "경기도",
        minLat: 37.1,
        maxLat: 37.4,
        minLon: 127.0,
        maxLon: 127.3,
      },
      {
        city: "성남시",
        region: "경기도",
        minLat: 37.35,
        maxLat: 37.5,
        minLon: 127.0,
        maxLon: 127.2,
      },
      {
        city: "화성시",
        region: "경기도",
        minLat: 37.0,
        maxLat: 37.3,
        minLon: 126.6,
        maxLon: 127.1,
      },
      {
        city: "안양시",
        region: "경기도",
        minLat: 37.35,
        maxLat: 37.45,
        minLon: 126.9,
        maxLon: 127.0,
      },
      {
        city: "부천시",
        region: "경기도",
        minLat: 37.45,
        maxLat: 37.55,
        minLon: 126.7,
        maxLon: 126.85,
      },
    ];

    // 좌표가 어느 도시 범위에 속하는지 확인
    for (const range of cityRanges) {
      if (
        latitude >= range.minLat &&
        latitude <= range.maxLat &&
        longitude >= range.minLon &&
        longitude <= range.maxLon
      ) {
        logger.info(`📍 좌표 기반 도시 추정: ${range.city}`);

        return {
          city: range.city,
          simpleCity: range.city.replace("시", ""),
          district: "",
          fullAddress: range.city,
          region: range.region,
          country: "KR",
          lat: latitude,
          lon: longitude,
          confidence: 0.7,
          method: "gps_estimate",
          timestamp: new Date(),
        };
      }
    }

    // 대한민국 범위 내라면 기본값 사용
    if (
      latitude >= 33 &&
      latitude <= 39 &&
      longitude >= 124 &&
      longitude <= 132
    ) {
      logger.info("📍 대한민국 내 위치 - 기본값 사용");
      return {
        ...this.getDefaultLocation(),
        lat: latitude,
        lon: longitude,
        method: "gps_default",
        confidence: 0.5,
      };
    }

    // 대한민국 외 지역
    logger.warn("📍 대한민국 외 GPS 좌표 감지");
    return this.getDefaultLocation();
  }

  /**
   * 🎯 위치 감지 (사용자별 저장된 위치 우선)
   *
   * 우선순위:
   * 1. GPS 좌표 (텔레그램 위치 공유)
   * 2. 사용자가 설정한 위치 (DB)
   * 3. 캐시된 위치
   * 4. 기본값
   */
  async detectLocation(userId, userPreferredLocation = null, gpsCoords = null) {
    try {
      // 1. GPS 좌표가 있으면 최우선 사용
      if (gpsCoords && gpsCoords.latitude && gpsCoords.longitude) {
        logger.info(
          `🛰️ GPS 좌표 사용: ${gpsCoords.latitude}, ${gpsCoords.longitude}`
        );
        const location = await this.getAddressFromGPS(
          gpsCoords.latitude,
          gpsCoords.longitude
        );

        // GPS 위치 캐시 저장
        if (userId) {
          this.setCache(userId, location);
        }

        return location;
      }

      // 2. 사용자가 명시적으로 설정한 위치
      if (userPreferredLocation) {
        logger.info(`📍 사용자 설정 위치 사용: ${userPreferredLocation}`);
        return this.parseUserLocation(userPreferredLocation);
      }

      // 3. 캐시된 위치
      const cached = this.getCache(userId);
      if (cached) {
        logger.info(
          `📦 캐시된 위치 사용: ${cached.city} ${cached.district || ""}`
        );
        return cached;
      }

      // 4. 기본값 사용
      logger.info(`📌 기본 위치 사용: ${this.defaultLocation}`);
      return this.getDefaultLocation();
    } catch (error) {
      logger.error("위치 감지 전체 실패:", error);
      return this.getDefaultLocation();
    }
  }

  /**
   * 🔍 카카오 API로 장소 검색
   */
  async searchLocation(query) {
    if (!this.kakaoApiKey) {
      logger.warn("카카오 API 키가 없어 장소 검색 불가");
      return null;
    }

    try {
      // 1. 키워드로 장소 검색
      const response = await axios.get(
        "https://dapi.kakao.com/v2/local/search/keyword.json",
        {
          params: {
            query: query,
            category_group_code: "AD5", // 숙박, 부동산
            size: 5,
          },
          headers: {
            Authorization: `KakaoAK ${this.kakaoApiKey}`,
          },
          timeout: 5000,
        }
      );

      if (response.data.documents && response.data.documents.length > 0) {
        const results = response.data.documents.map((doc) => ({
          name: doc.place_name,
          address: doc.address_name,
          city: this.extractCityFromString(doc.address_name),
          lat: parseFloat(doc.y),
          lon: parseFloat(doc.x),
        }));

        logger.info(`🔍 장소 검색 결과: ${results.length}개`);
        return results;
      }

      // 2. 주소로 검색 시도
      const addrResponse = await axios.get(
        "https://dapi.kakao.com/v2/local/search/address.json",
        {
          params: {
            query: query,
            size: 5,
          },
          headers: {
            Authorization: `KakaoAK ${this.kakaoApiKey}`,
          },
          timeout: 5000,
        }
      );

      if (
        addrResponse.data.documents &&
        addrResponse.data.documents.length > 0
      ) {
        const results = addrResponse.data.documents.map((doc) => ({
          name: doc.address_name,
          address: doc.address_name,
          city: this.extractCityFromString(doc.address_name),
          lat: parseFloat(doc.y),
          lon: parseFloat(doc.x),
        }));

        return results;
      }

      return [];
    } catch (error) {
      logger.error("카카오 장소 검색 실패:", error.message);
      return [];
    }
  }

  /**
   * 🏷️ 문자열에서 도시명 추출
   */
  extractCityFromString(address) {
    const parts = address.split(" ");

    // 광역시 찾기
    for (const part of parts) {
      if (part.includes("광역시")) {
        return part.replace("광역시", "");
      }
    }

    // 일반 시 찾기
    for (const part of parts) {
      if (part.endsWith("시") && part.length > 2) {
        return part;
      }
    }

    return this.defaultLocation;
  }

  /**
   * 📍 사용자 입력 위치 파싱
   */
  parseUserLocation(location) {
    const normalized = this.normalizeLocationName(location);

    return {
      city: normalized,
      simpleCity: normalized.replace("시", ""),
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
      // 경기도 도시들
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
    };

    return regionMap[city] || this.defaultRegion;
  }

  /**
   * 🏠 기본 위치
   */
  getDefaultLocation() {
    const defaultCity = this.defaultLocation;
    const defaultRegion = this.getRegionByCity(defaultCity);

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
      lat: 37.2636,
      lon: 127.0286,
    }; // 수원시 좌표를 기본값으로

    return {
      city: defaultCity,
      simpleCity: defaultCity.replace("시", ""),
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
      hasKakaoKey: !!this.kakaoApiKey,
    };
  }
}

module.exports = LocationHelper;
