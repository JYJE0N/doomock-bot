// src/utils/LocationHelper.js - 위치 감지 헬퍼

const axios = require("axios");
const logger = require("../core/Logger");

/**
 * 📍 LocationHelper - 위치 감지 유틸리티
 *
 * Railway 환경에서 안전하게 작동하는 위치 감지
 */
class LocationHelper {
  constructor() {
    this.kakaoApiKey = process.env.KAKAO_API_KEY;
    this.ipApiKey = process.env.IP_API_KEY;

    // 기본 위치 설정
    this.defaultLocation = {
      city: "화성시",
      district: "",
      simpleCity: "화성",
      method: "default",
      latitude: 37.1498,
      longitude: 126.832
    };

    logger.info("📍 LocationHelper 초기화됨", {
      hasKakaoKey: !!this.kakaoApiKey,
      hasIpApiKey: !!this.ipApiKey
    });
  }

  /**
   * 🌍 위치 감지 (Railway 안전 버전)
   */
  async detectLocation(userId = null) {
    try {
      // 1. IP 기반 위치 감지 시도
      if (this.ipApiKey) {
        try {
          const ipLocation = await this.getLocationByIP();
          if (ipLocation.success) {
            return ipLocation.data;
          }
        } catch (error) {
          logger.warn("IP 기반 위치 감지 실패:", error.message);
        }
      }

      // 2. Railway 환경에서는 한국 주요 도시 중 랜덤 선택
      if (process.env.RAILWAY_ENVIRONMENT) {
        return this.getRandomKoreanCity();
      }

      // 3. 기본 위치 반환
      return this.defaultLocation;
    } catch (error) {
      logger.error("위치 감지 실패:", error);
      return this.defaultLocation;
    }
  }

  /**
   * 🌐 IP 기반 위치 감지
   */
  async getLocationByIP() {
    try {
      const response = await axios.get("http://ip-api.com/json", {
        timeout: 3000
      });

      if (
        response.data.status === "success" &&
        response.data.country === "South Korea"
      ) {
        const city = this.translateCityName(response.data.city);
        return {
          success: true,
          data: {
            city: city,
            district: response.data.regionName || "",
            simpleCity: city.replace("시", ""),
            method: "ip_api",
            latitude: response.data.lat,
            longitude: response.data.lon
          }
        };
      }

      return { success: false };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 🎲 한국 주요 도시 랜덤 선택
   */
  getRandomKoreanCity() {
    const cities = [
      { city: "서울시", district: "강남구", lat: 37.5665, lon: 126.978 },
      { city: "부산시", district: "해운대구", lat: 35.1796, lon: 129.0756 },
      { city: "대구시", district: "중구", lat: 35.8714, lon: 128.6014 },
      { city: "인천시", district: "남동구", lat: 37.4563, lon: 126.7052 },
      { city: "광주시", district: "서구", lat: 35.1595, lon: 126.8526 },
      { city: "대전시", district: "서구", lat: 36.3504, lon: 127.3845 },
      { city: "울산시", district: "남구", lat: 35.5384, lon: 129.3114 },
      { city: "수원시", district: "팔달구", lat: 37.2636, lon: 127.0286 },
      { city: "화성시", district: "동탄", lat: 37.1498, lon: 126.832 },
      { city: "용인시", district: "수지구", lat: 37.3236, lon: 127.0979 }
    ];

    const randomCity = cities[Math.floor(Math.random() * cities.length)];

    logger.info(`🎲 랜덤 도시 선택: ${randomCity.city}`);

    return {
      city: randomCity.city,
      district: randomCity.district,
      simpleCity: randomCity.city.replace("시", ""),
      method: "random",
      latitude: randomCity.lat,
      longitude: randomCity.lon
    };
  }

  /**
   * 🔤 도시명 번역
   */
  translateCityName(englishName) {
    const cityMap = {
      Seoul: "서울시",
      Busan: "부산시",
      Incheon: "인천시",
      Daegu: "대구시",
      Daejeon: "대전시",
      Gwangju: "광주시",
      Suwon: "수원시",
      Ulsan: "울산시",
      Changwon: "창원시",
      Seongnam: "성남시",
      Hwaseong: "화성시",
      Yongin: "용인시"
    };

    return cityMap[englishName] || englishName;
  }

  /**
   * 📍 좌표로 주소 변환 (Kakao API)
   */
  async getAddressByCoords(latitude, longitude) {
    if (!this.kakaoApiKey) {
      return { success: false, error: "Kakao API 키 없음" };
    }

    try {
      const response = await axios.get(
        "https://dapi.kakao.com/v2/local/geo/coord2address.json",
        {
          params: { x: longitude, y: latitude },
          headers: { Authorization: `KakaoAK ${this.kakaoApiKey}` },
          timeout: 3000
        }
      );

      if (response.data.documents && response.data.documents.length > 0) {
        const address = response.data.documents[0].address;
        return {
          success: true,
          data: {
            city: address.region_2depth_name,
            district: address.region_3depth_name,
            fullAddress: address.address_name
          }
        };
      }

      return { success: false };
    } catch (error) {
      logger.error("Kakao 주소 변환 실패:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 🏙️ 도시명 정규화
   */
  normalizeCity(cityName) {
    if (!cityName) return "화성시";

    // "시" 제거
    let normalized = cityName.replace(/시$/, "");

    // 특별시/광역시 처리
    normalized = normalized.replace(/특별시|광역시/, "");

    // 다시 "시" 추가
    if (!normalized.endsWith("시")) {
      normalized += "시";
    }

    return normalized;
  }
}

module.exports = LocationHelper;
