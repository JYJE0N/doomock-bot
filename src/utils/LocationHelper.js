// LocationHelper.js - 카카오 API 추가

const axios = require("axios");
const logger = require("./Logger");

class LocationHelper {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10분 (실시간성을 위해 짧게)
    this.kakaoApiKey = process.env.KAKAO_API_KEY;
  }

  /**
   * 🎯 자동 위치 감지 - 카카오 API 우선
   */
  async detectLocation(userId) {
    // 1. 캐시 확인 (짧은 시간)
    const cached = this.getCache(userId);
    if (cached) {
      logger.info(`📦 캐시된 위치 사용: ${cached.city} (${cached.district})`);
      return cached;
    }

    // 2. 카카오 API로 현재 위치 감지 시도
    try {
      const location = await this.detectByKakaoIP();
      if (location && location.city) {
        logger.info(
          `✅ 카카오 위치 감지 성공: ${location.city} ${location.district}`
        );
        this.setCache(userId, location);
        return location;
      }
    } catch (error) {
      logger.warn("카카오 위치 감지 실패:", error.message);
    }

    // 3. IP 기반 위치 감지 (폴백)
    try {
      const location = await this.detectByIP();
      if (location && location.city) {
        this.setCache(userId, location);
        return location;
      }
    } catch (error) {
      logger.warn("IP 위치 감지 실패:", error.message);
    }

    // 4. 기본값
    return this.getDefaultLocation();
  }

  /**
   * 🗺️ 카카오 API로 현재 위치 감지
   */
  async detectByKakaoIP() {
    if (!this.kakaoApiKey) {
      throw new Error("카카오 API 키가 없습니다");
    }

    try {
      // 1. 먼저 IP로 대략적인 좌표 얻기
      const ipResponse = await axios.get("http://ip-api.com/json/", {
        timeout: 3000,
      });

      if (!ipResponse.data || !ipResponse.data.lat) {
        throw new Error("IP 좌표를 얻을 수 없습니다");
      }

      const { lat, lon } = ipResponse.data;

      // 2. 카카오 API로 정확한 주소 얻기
      const kakaoResponse = await axios.get(
        "https://dapi.kakao.com/v2/local/geo/coord2address.json",
        {
          params: {
            x: lon,
            y: lat,
            input_coord: "WGS84",
          },
          headers: {
            Authorization: `KakaoAK ${this.kakaoApiKey}`,
          },
          timeout: 5000,
        }
      );

      if (
        kakaoResponse.data.documents &&
        kakaoResponse.data.documents.length > 0
      ) {
        const address = kakaoResponse.data.documents[0].address;
        const roadAddress = kakaoResponse.data.documents[0].road_address;

        // 🔥 도시명 단순화
        let simpleCity = address.region_2depth_name;

        // "용인시 수지구" → "용인시"로 단순화
        if (simpleCity.includes(" ")) {
          simpleCity = simpleCity.split(" ")[0]; // "용인시 수지구" → "용인시"
        }

        return {
          city: address.region_2depth_name, // 원본 (용인시 수지구)
          district: address.region_3depth_name, // 동 (상현동)
          simpleCity: simpleCity, // 🔥 단순화된 도시명 (용인시)
          address: roadAddress
            ? roadAddress.address_name
            : address.address_name,
          region: address.region_1depth_name,
          country: "KR",
          lat: lat,
          lon: lon,
          confidence: 0.9,
          method: "kakao_api",
          timestamp: new Date(),
        };
      }
    } catch (error) {
      logger.error("카카오 API 오류:", error.response?.data || error.message);
      throw error;
    }
  } // 🔥 여기가 올바른 위치!

  /**
   * 🌐 IP 기반 위치 감지 (개선)
   */
  async detectByIP() {
    try {
      const response = await axios.get("https://ipapi.co/json/", {
        timeout: 3000,
      });

      if (response.data && response.data.city) {
        // 영문 도시명을 한글로 매핑
        const cityMap = {
          Yongin: "용인시",
          Suwon: "수원시",
          Hwaseong: "화성시",
          Seoul: "서울",
          Seongnam: "성남시",
          Ansan: "안산시",
        };

        const city = cityMap[response.data.city] || response.data.city;

        return {
          city: city,
          simpleCity: city, // 🔥 IP 감지도 simpleCity 추가
          district: "",
          region: response.data.region || "경기도",
          country: "KR",
          lat: response.data.latitude,
          lon: response.data.longitude,
          confidence: 0.6,
          method: "ip_detection",
          timestamp: new Date(),
        };
      }
    } catch (error) {
      logger.debug("IP 위치 감지 실패:", error.message);
    }
    return null;
  }

  /**
   * 🏠 기본 위치
   */
  getDefaultLocation() {
    return {
      city: "화성시",
      simpleCity: "화성시", // 🔥 기본값도 simpleCity 추가
      district: "능동",
      region: "경기도",
      country: "KR",
      confidence: 0.3,
      method: "default",
      timestamp: new Date(),
    };
  }

  // 캐시 관리
  getCache(userId) {
    const cached = this.cache.get(`location_${userId}`);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
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
}

module.exports = LocationHelper;
