// src/utils/LocationHelper.js - GPS 위치 감지 개선

const axios = require("axios");
const logger = require("./Logger");

/**
 * 📍 LocationHelper - GPS 및 카카오맵 기반 위치 감지
 */
class LocationHelper {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10분 (실시간성을 위해 짧게)
    this.kakaoApiKey = process.env.KAKAO_API_KEY;

    // IP 기반 위치 서비스 URL들 (백업용)
    this.ipServices = [
      "https://ipapi.co/json/",
      "http://ip-api.com/json/",
      "https://ipinfo.io/json",
    ];

    logger.info("📍 LocationHelper 초기화", {
      hasKakaoKey: !!this.kakaoApiKey,
      cacheTimeout: this.cacheTimeout,
    });
  }

  /**
   * 🎯 자동 위치 감지 - 사용자별 저장된 위치 우선
   *
   * 우선순위:
   * 1. 사용자가 설정한 위치 (DB)
   * 2. 캐시된 위치
   * 3. IP 기반 위치 감지
   * 4. 기본값 (화성시)
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

      // 3. IP 기반 위치 감지 (실제로는 이것만 사용)
      try {
        const location = await this.detectByIP();
        if (location && location.city) {
          logger.info(`📡 IP 위치 감지 성공: ${location.city}`);
          this.setCache(userId, location);
          return location;
        }
      } catch (error) {
        logger.warn("IP 위치 감지 실패:", error.message);
      }

      // 4. 기본값
      logger.info("📌 기본 위치 사용: 화성시");
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
      // 다른 지역들...
    };

    return regionMap[city] || "경기도";
  }

  /**
   * 🗺️ 카카오 API로 지역명 검색 (향후 구현용)
   *
   * 참고: 현재는 IP 기반 위치만 사용
   * 향후 사용자가 입력한 지역명으로 좌표를 찾는 기능 추가 가능
   */
  async searchLocationByKakao(locationName) {
    if (!this.kakaoApiKey) {
      logger.warn("카카오 API 키가 없어 지역 검색 불가");
      return null;
    }

    try {
      // 카카오 주소 검색 API
      const response = await axios.get(
        "https://dapi.kakao.com/v2/local/search/address.json",
        {
          params: {
            query: locationName,
            size: 1,
          },
          headers: {
            Authorization: `KakaoAK ${this.kakaoApiKey}`,
          },
          timeout: 5000,
        }
      );

      if (response.data.documents && response.data.documents.length > 0) {
        const doc = response.data.documents[0];

        return {
          city: doc.address_name,
          simpleCity: doc.address_name.split(" ")[1] || doc.address_name,
          district: "",
          fullAddress: doc.address_name,
          region: doc.address_name.split(" ")[0],
          country: "KR",
          lat: parseFloat(doc.y),
          lon: parseFloat(doc.x),
          confidence: 0.8,
          method: "kakao_search",
          timestamp: new Date(),
        };
      }

      return null;
    } catch (error) {
      logger.error("카카오 지역 검색 실패:", error.message);
      return null;
    }
  }

  /**
   * 🌐 IP 기반 위치 감지 (개선)
   */
  async detectByIP() {
    // 여러 IP 서비스 시도
    for (const serviceUrl of this.ipServices) {
      try {
        const response = await axios.get(serviceUrl, {
          timeout: 3000,
          headers: {
            "User-Agent": "TelegramBot/1.0",
          },
        });

        if (response.data) {
          // 서비스별 데이터 정규화
          let cityName, regionName, lat, lon;

          if (serviceUrl.includes("ipapi.co")) {
            cityName = response.data.city;
            regionName = response.data.region;
            lat = response.data.latitude;
            lon = response.data.longitude;
          } else if (serviceUrl.includes("ip-api.com")) {
            cityName = response.data.city;
            regionName = response.data.regionName;
            lat = response.data.lat;
            lon = response.data.lon;
          } else if (serviceUrl.includes("ipinfo.io")) {
            cityName = response.data.city;
            regionName = response.data.region;
            const [latStr, lonStr] = (response.data.loc || "").split(",");
            lat = parseFloat(latStr);
            lon = parseFloat(lonStr);
          }

          if (cityName) {
            // 영문 도시명을 한글로 매핑 (확장)
            const cityMap = {
              Seoul: "서울",
              Busan: "부산",
              Incheon: "인천",
              Daegu: "대구",
              Daejeon: "대전",
              Gwangju: "광주",
              Ulsan: "울산",
              Suwon: "수원시",
              "Suwon-si": "수원시",
              Yongin: "용인시",
              "Yongin-si": "용인시",
              Seongnam: "성남시",
              "Seongnam-si": "성남시",
              Hwaseong: "화성시",
              "Hwaseong-si": "화성시",
              Ansan: "안산시",
              "Ansan-si": "안산시",
              Anyang: "안양시",
              "Anyang-si": "안양시",
              Bucheon: "부천시",
              "Bucheon-si": "부천시",
              Pyeongtaek: "평택시",
              "Pyeongtaek-si": "평택시",
              Goyang: "고양시",
              "Goyang-si": "고양시",
              Namyangju: "남양주시",
              "Namyangju-si": "남양주시",
              Uijeongbu: "의정부시",
              "Uijeongbu-si": "의정부시",
              Paju: "파주시",
              "Paju-si": "파주시",
              Gimpo: "김포시",
              "Gimpo-si": "김포시",
              Gwangmyeong: "광명시",
              "Gwangmyeong-si": "광명시",
              Siheung: "시흥시",
              "Siheung-si": "시흥시",
              Gunpo: "군포시",
              "Gunpo-si": "군포시",
              Uiwang: "의왕시",
              "Uiwang-si": "의왕시",
              Hanam: "하남시",
              "Hanam-si": "하남시",
              Osan: "오산시",
              "Osan-si": "오산시",
              Yangju: "양주시",
              "Yangju-si": "양주시",
            };

            const city = cityMap[cityName] || cityName;

            return {
              city: city,
              simpleCity: city,
              district: "",
              fullAddress: city,
              region: regionName || "경기도",
              country: "KR",
              lat: lat || 37.5665,
              lon: lon || 126.978,
              confidence: 0.6,
              method: "ip_detection",
              timestamp: new Date(),
            };
          }
        }
      } catch (error) {
        logger.debug(`IP 서비스 실패 (${serviceUrl}):`, error.message);
        continue; // 다음 서비스 시도
      }
    }

    return null;
  }

  /**
   * 🏠 기본 위치
   */
  getDefaultLocation() {
    return {
      city: "화성시",
      simpleCity: "화성시",
      district: "동탄",
      fullAddress: "화성시 동탄",
      region: "경기도",
      country: "KR",
      lat: 37.2063,
      lon: 127.0728,
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
    };
  }
}

module.exports = LocationHelper;
