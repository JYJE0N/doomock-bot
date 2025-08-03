// src/utils/UserHelper.js - 새로운 간단명확한 사용자 헬퍼 v4.0.1
const logger = require("./Logger");

/**
 * 👤 UserHelper v4.0.1 - 간단하고 명확한 사용자 정보 헬퍼
 *
 * 🎯 핵심 원칙:
 * - 간단함이 최고 (Keep It Simple)
 * - 일관성 있는 API
 * - 에러에 강한 구조
 * - 텔레그램 API 완벽 지원
 *
 * 🔧 사용법:
 * - getUserName(msg) 또는 getUserName(callbackQuery)
 * - getUserId(msg) 또는 getUserId(callbackQuery)
 * - isAdmin(msg) 또는 isAdmin(callbackQuery)
 */

/**
 * 👤 사용자 이름 추출 (가장 중요한 함수!)
 * @param {Object} input - msg 또는 callbackQuery 객체
 * @returns {string} 사용자 이름
 */
function getUserName(input) {
  try {
    // null/undefined 체크
    if (!input) {
      return "알 수 없는 사용자";
    }

    // 사용자 객체 찾기
    let user = null;

    // 1) callbackQuery.from (콜백에서)
    if (input.from) {
      user = input.from;
    }
    // 2) msg.from (일반 메시지에서)
    else if (input.message && input.message.from) {
      user = input.message.from;
    }
    // 3) msg 자체가 user 객체인 경우
    else if (input.id && (input.first_name || input.username)) {
      user = input;
    }

    // 사용자 객체가 없으면
    if (!user) {
      return "알 수 없는 사용자";
    }

    // 봇인 경우 특별 처리
    if (user.is_bot) {
      return `[봇] ${user.first_name || user.username || `Bot#${user.id}`}`;
    }

    // 이름 우선순위: first_name + last_name > username > ID
    if (user.first_name) {
      let name = user.first_name;
      if (user.last_name) {
        name += ` ${user.last_name}`;
      }
      return name;
    }

    if (user.username) {
      return `@${user.username}`;
    }

    return `User#${user.id}`;
  } catch (error) {
    logger.warn("getUserName 오류:", error.message);
    return "알 수 없는 사용자";
  }
}

/**
 * 🆔 사용자 ID 추출
 * @param {Object} input - msg 또는 callbackQuery 객체
 * @returns {number|null} 사용자 ID
 */
function getUserId(input) {
  try {
    // null/undefined 체크
    if (!input) {
      return null;
    }

    // 사용자 객체 찾기
    let user = null;

    // 1) callbackQuery.from (콜백에서)
    if (input.from) {
      user = input.from;
    }
    // 2) msg.from (일반 메시지에서)
    else if (input.message && input.message.from) {
      user = input.message.from;
    }
    // 3) msg 자체가 user 객체인 경우
    else if (input.id) {
      user = input;
    }

    return user?.id || null;
  } catch (error) {
    logger.warn("getUserId 오류:", error.message);
    return null;
  }
}

/**
 * 👤 사용자 전체 정보 추출
 * @param {Object} input - msg 또는 callbackQuery 객체
 * @returns {Object|null} 사용자 정보 객체
 */
function getUserInfo(input) {
  try {
    // null/undefined 체크
    if (!input) {
      return null;
    }

    // 사용자 객체 찾기
    let user = null;

    // 1) callbackQuery.from (콜백에서)
    if (input.from) {
      user = input.from;
    }
    // 2) msg.from (일반 메시지에서)
    else if (input.message && input.message.from) {
      user = input.message.from;
    }
    // 3) msg 자체가 user 객체인 경우
    else if (input.id) {
      user = input;
    }

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      firstName: user.first_name || "",
      lastName: user.last_name || "",
      username: user.username || "",
      fullName: getUserName(input),
      languageCode: user.language_code || "ko",
      isBot: user.is_bot || false,
      isPremium: user.is_premium || false
    };
  } catch (error) {
    logger.warn("getUserInfo 오류:", error.message);
    return null;
  }
}

/**
 * 💬 채팅방 정보 추출
 * @param {Object} input - msg 또는 callbackQuery 객체
 * @returns {Object|null} 채팅방 정보 객체
 */
function getChatInfo(input) {
  try {
    // null/undefined 체크
    if (!input) {
      return null;
    }

    // 채팅 객체 찾기
    let chat = null;

    // 1) msg.chat (일반 메시지에서)
    if (input.chat) {
      chat = input.chat;
    }
    // 2) callbackQuery.message.chat (콜백에서)
    else if (input.message && input.message.chat) {
      chat = input.message.chat;
    }

    if (!chat) {
      return null;
    }

    return {
      id: chat.id,
      type: chat.type, // private, group, supergroup, channel
      title: chat.title || "",
      username: chat.username || "",
      firstName: chat.first_name || "",
      lastName: chat.last_name || "",
      isPrivate: chat.type === "private",
      isGroup: chat.type === "group" || chat.type === "supergroup",
      isChannel: chat.type === "channel"
    };
  } catch (error) {
    logger.warn("getChatInfo 오류:", error.message);
    return null;
  }
}

/**
 * 🔑 관리자 권한 확인
 * @param {Object} input - msg 또는 callbackQuery 객체
 * @returns {boolean} 관리자 여부
 */
function isAdmin(input) {
  try {
    const userId = getUserId(input);
    if (!userId) {
      return false;
    }

    // 환경변수에서 관리자 ID 목록 로드
    const adminIdsStr = process.env.ADMIN_IDS || "";
    const adminIds = adminIdsStr
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id)
      .map((id) => parseInt(id))
      .filter((id) => !isNaN(id));

    return adminIds.includes(userId);
  } catch (error) {
    logger.warn("isAdmin 오류:", error.message);
    return false;
  }
}

/**
 * 🤖 봇 여부 확인
 * @param {Object} input - msg 또는 callbackQuery 객체
 * @returns {boolean} 봇 여부
 */
function isBot(input) {
  try {
    const userInfo = getUserInfo(input);
    return userInfo?.isBot || false;
  } catch (error) {
    logger.warn("isBot 오류:", error.message);
    return false;
  }
}

/**
 * 💎 프리미엄 사용자 여부 확인
 * @param {Object} input - msg 또는 callbackQuery 객체
 * @returns {boolean} 프리미엄 여부
 */
function isPremium(input) {
  try {
    const userInfo = getUserInfo(input);
    return userInfo?.isPremium || false;
  } catch (error) {
    logger.warn("isPremium 오류:", error.message);
    return false;
  }
}

/**
 * 🌍 사용자 언어 가져오기
 * @param {Object} input - msg 또는 callbackQuery 객체
 * @returns {string} 언어 코드 (기본값: 'ko')
 */
function getUserLanguage(input) {
  try {
    const userInfo = getUserInfo(input);
    return userInfo?.languageCode || "ko";
  } catch (error) {
    logger.warn("getUserLanguage 오류:", error.message);
    return "ko";
  }
}

/**
 * 📱 사용자 멘션 생성 (마크다운용)
 * @param {Object} input - msg 또는 callbackQuery 객체
 * @returns {string} 멘션 문자열
 */
function getMention(input) {
  try {
    const userId = getUserId(input);
    const userName = getUserName(input);

    if (!userId || userName === "알 수 없는 사용자") {
      return userName;
    }

    // 마크다운 멘션 형식
    return `[${userName}](tg://user?id=${userId})`;
  } catch (error) {
    logger.warn("getMention 오류:", error.message);
    return getUserName(input);
  }
}

/**
 * 🔗 사용자 링크 생성
 * @param {Object} input - msg 또는 callbackQuery 객체
 * @returns {string} 사용자 링크
 */
function getUserLink(input) {
  try {
    const userInfo = getUserInfo(input);
    if (!userInfo) {
      return "";
    }

    // username이 있으면 t.me 링크
    if (userInfo.username) {
      return `https://t.me/${userInfo.username}`;
    }

    // 없으면 tg:// 링크
    return `tg://user?id=${userInfo.id}`;
  } catch (error) {
    logger.warn("getUserLink 오류:", error.message);
    return "";
  }
}

/**
 * 🔍 사용자 검증
 * @param {Object} input - msg 또는 callbackQuery 객체
 * @returns {Object} 검증 결과
 */
function validateUser(input) {
  try {
    const userInfo = getUserInfo(input);

    if (!userInfo) {
      return {
        valid: false,
        reason: "사용자 정보 없음",
        details: "입력에서 사용자 정보를 찾을 수 없습니다."
      };
    }

    if (userInfo.isBot) {
      const botId = process.env.BOT_ID || null;
      if (botId && userInfo.id !== parseInt(botId)) {
        return {
          valid: false,
          reason: "다른 봇의 메시지",
          details: `봇 ID ${userInfo.id}는 허용되지 않습니다.`
        };
      }
    }

    return {
      valid: true,
      reason: "검증 통과",
      userInfo
    };
  } catch (error) {
    logger.warn("validateUser 오류:", error.message);
    return {
      valid: false,
      reason: "검증 중 오류 발생",
      details: error.message
    };
  }
}

/**
 * 🏷️ 안전한 사용자 이름 (로깅/디버깅용)
 * @param {Object} input - msg 또는 callbackQuery 객체
 * @returns {string} 안전한 사용자 이름
 */
function getSafeUserName(input) {
  try {
    const userName = getUserName(input);
    const userId = getUserId(input);

    // 알 수 없는 사용자인 경우 ID라도 표시
    if (userName === "알 수 없는 사용자" && userId) {
      return `User#${userId}`;
    }

    return userName === "알 수 없는 사용자" ? "익명사용자" : userName;
  } catch (error) {
    return "오류발생사용자";
  }
}

/**
 * 🎭 익명화된 사용자 ID (개인정보보호용)
 * @param {Object} input - msg 또는 callbackQuery 객체
 * @returns {string} 익명화된 ID
 */
function getAnonymousId(input) {
  try {
    const userId = getUserId(input);
    if (!userId) {
      return "unknown";
    }

    const idStr = userId.toString();
    if (idStr.length <= 5) {
      return idStr;
    }

    // 앞 3자리와 뒤 2자리만 표시
    return `${idStr.slice(0, 3)}***${idStr.slice(-2)}`;
  } catch (error) {
    return "error";
  }
}

/**
 * 📊 사용자 권한 레벨 계산
 * @param {Object} input - msg 또는 callbackQuery 객체
 * @returns {number} 권한 레벨 (0-100)
 */
function getPermissionLevel(input) {
  try {
    // 관리자
    if (isAdmin(input)) {
      return 100;
    }

    // 프리미엄 사용자
    if (isPremium(input)) {
      return 50;
    }

    // 일반 사용자
    const userInfo = getUserInfo(input);
    if (userInfo) {
      return 10;
    }

    // 알 수 없는 사용자
    return 0;
  } catch (error) {
    logger.warn("getPermissionLevel 오류:", error.message);
    return 0;
  }
}

/**
 * 🏷️ 사용자 표시명 생성 (UI용)
 * @param {Object} input - msg 또는 callbackQuery 객체
 * @returns {string} 표시용 이름
 */
function getDisplayName(input) {
  try {
    const userInfo = getUserInfo(input);
    if (!userInfo) {
      return "익명";
    }

    // 관리자 표시
    if (isAdmin(input)) {
      return `👑 ${userInfo.fullName}`;
    }

    // 프리미엄 표시
    if (userInfo.isPremium) {
      return `💎 ${userInfo.fullName}`;
    }

    // 봇 표시
    if (userInfo.isBot) {
      return `🤖 ${userInfo.fullName}`;
    }

    // 일반 사용자
    return userInfo.fullName;
  } catch (error) {
    logger.warn("getDisplayName 오류:", error.message);
    return "오류";
  }
}

// ===== 🔧 테스트 및 디버그 함수들 =====

/**
 * 🧪 UserHelper 테스트 함수
 * @param {Object} input - 테스트할 입력 객체
 */
function testUserHelper(input) {
  console.log("🧪 UserHelper 테스트:");
  console.log("  입력:", JSON.stringify(input, null, 2));
  console.log("  getUserName:", getUserName(input));
  console.log("  getUserId:", getUserId(input));
  console.log("  getUserInfo:", getUserInfo(input));
  console.log("  isAdmin:", isAdmin(input));
  console.log("  isBot:", isBot(input));
  console.log("  isPremium:", isPremium(input));
  console.log("  validateUser:", validateUser(input));
  console.log("  getDisplayName:", getDisplayName(input));
  console.log("  getSafeUserName:", getSafeUserName(input));
}

// ===== 📤 모듈 익스포트 =====

module.exports = {
  // 핵심 함수들 (가장 많이 사용됨)
  getUserName,
  getUserId,
  getUserInfo,
  getChatInfo,

  // 권한 관련
  isAdmin,
  isBot,
  isPremium,
  getPermissionLevel,

  // 유틸리티
  getUserLanguage,
  getMention,
  getUserLink,
  validateUser,

  // 안전/표시 관련
  getSafeUserName,
  getDisplayName,
  getAnonymousId,

  // 테스트
  testUserHelper
};

// 로깅
logger.info("👤 UserHelper v4.0.1 로드됨 (새로운 간단명확 구조)");
