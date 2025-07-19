// src/utils/UserHelper.js - 완전히 개선된 버전

/**
 * 텔레그램 사용자 정보 관련 유틸리티 함수들
 * 프로젝트 전체에서 일관된 사용자 이름 처리를 위함
 */

/**
 * 🎯 기본 사용자 표시 이름 (짧은 형태)
 * 봇에서 가장 많이 사용되는 기본 함수
 *
 * @param {Object} user - 텔레그램 사용자 객체
 * @returns {string} 사용자 표시 이름
 */
function getUserName(user) {
  if (!user) {
    return "사용자";
  }

  // ⭐ 우선순위: first_name > username > 사용자ID
  if (user.first_name && user.first_name.trim()) {
    return user.first_name.trim();
  }

  if (user.username && user.username.trim()) {
    return user.username.trim();
  }

  return `사용자${user.id}`;
}

/**
 * 🎯 전체 사용자 이름 (긴 형태)
 * 공식적인 상황에서 사용
 *
 * @param {Object} user - 텔레그램 사용자 객체
 * @returns {string} 전체 이름
 */
function getFullUserName(user) {
  if (!user) {
    return "사용자";
  }

  let fullName = "";

  if (user.first_name && user.first_name.trim()) {
    fullName += user.first_name.trim();
  }

  if (user.last_name && user.last_name.trim()) {
    fullName += " " + user.last_name.trim();
  }

  // 풀네임이 있으면 반환, 없으면 기본 getUserName 사용
  return fullName.trim() || getUserName(user);
}

/**
 * 🎯 사용자 멘션 텍스트 (텔레그램 링크 포함)
 *
 * @param {Object} user - 텔레그램 사용자 객체
 * @returns {string} 멘션 텍스트
 */
function getUserMention(user) {
  if (!user) {
    return "사용자";
  }

  const displayName = getUserName(user);

  // username이 있으면 @username 형태
  if (user.username && user.username.trim()) {
    return `@${user.username.trim()}`;
  }

  // username이 없으면 텔레그램 링크 형태
  return `[${displayName}](tg://user?id=${user.id})`;
}

/**
 * 🎯 짧은 표시 이름 (유저네임 우선)
 * 로그나 간단한 표시용
 *
 * @param {Object} user - 텔레그램 사용자 객체
 * @returns {string} 짧은 표시 이름
 */
function getShortUserName(user) {
  if (!user) {
    return "사용자";
  }

  // username을 우선적으로 사용
  if (user.username && user.username.trim()) {
    return `@${user.username.trim()}`;
  }

  if (user.first_name && user.first_name.trim()) {
    return user.first_name.trim();
  }

  return `사용자${user.id}`;
}

/**
 * 🎯 사용자 정보 요약 객체
 *
 * @param {Object} user - 텔레그램 사용자 객체
 * @returns {Object} 사용자 정보 요약
 */
function getUserSummary(user) {
  if (!user) {
    return {
      id: null,
      name: "사용자",
      fullName: "사용자",
      username: null,
      mention: "사용자",
      isBot: false,
      hasUsername: false,
      hasFirstName: false,
      hasLastName: false,
    };
  }

  return {
    id: user.id,
    name: getUserName(user),
    fullName: getFullUserName(user),
    username: user.username || null,
    mention: getUserMention(user),
    shortName: getShortUserName(user),
    isBot: user.is_bot || false,
    languageCode: user.language_code || "ko",
    hasUsername: !!(user.username && user.username.trim()),
    hasFirstName: !!(user.first_name && user.first_name.trim()),
    hasLastName: !!(user.last_name && user.last_name.trim()),
  };
}

/**
 * 🎯 다양한 형식으로 사용자 이름 포맷
 *
 * @param {Object} user - 텔레그램 사용자 객체
 * @param {string} format - 표시 형식
 * @returns {string} 형식에 맞는 사용자 표시 이름
 */
function formatUserDisplay(user, format = "default") {
  if (!user) {
    return "사용자";
  }

  switch (format) {
    case "default":
    case "short":
      return getUserName(user);

    case "full":
    case "long":
      return getFullUserName(user);

    case "mention":
      return getUserMention(user);

    case "username":
      return getShortUserName(user);

    case "formal":
      // 공식적인 상황용 (성함이 있으면 성함, 없으면 username)
      if (user.first_name || user.last_name) {
        return getFullUserName(user);
      }
      return getShortUserName(user);

    case "friendly":
      // 친근한 호칭 (이름 + 님)
      return getUserName(user) + "님";

    case "log":
      // 로그용 (ID 포함)
      return `${getUserName(user)}(${user.id})`;

    default:
      return getUserName(user);
  }
}

/**
 * 🎯 사용자 ID 검증
 *
 * @param {number} userId - 사용자 ID
 * @returns {boolean} 유효한 사용자 ID인지 여부
 */
function isValidUserId(userId) {
  return typeof userId === "number" && userId > 0 && userId < 2147483647;
}

/**
 * 🎯 사용자 권한 확인
 *
 * @param {Object} user - 텔레그램 사용자 객체
 * @param {Array} adminIds - 관리자 ID 배열
 * @returns {boolean} 관리자 권한 여부
 */
function isAdmin(user, adminIds = []) {
  if (!user || !Array.isArray(adminIds)) {
    return false;
  }
  return adminIds.includes(user.id);
}

/**
 * 🎯 사용자 허용 여부 확인
 *
 * @param {Object} user - 텔레그램 사용자 객체
 * @param {Array} allowedIds - 허용된 사용자 ID 배열
 * @returns {boolean} 허용된 사용자인지 여부
 */
function isAllowed(user, allowedIds = []) {
  if (!user) {
    return false;
  }

  // 빈 배열이면 모든 사용자 허용
  if (allowedIds.length === 0) {
    return true;
  }

  return allowedIds.includes(user.id);
}

/**
 * 🎯 사용자 언어 코드 정규화
 *
 * @param {string} languageCode - 언어 코드
 * @returns {string} 정규화된 언어 코드
 */
function normalizeLanguageCode(languageCode) {
  const supportedLanguages = {
    ko: "ko",
    kr: "ko",
    en: "en",
    us: "en",
    ja: "ja",
    jp: "ja",
    zh: "zh",
    cn: "zh",
    es: "es",
    fr: "fr",
    de: "de",
    ru: "ru",
  };

  if (!languageCode) {
    return "ko";
  }

  const normalized = languageCode.toLowerCase().substring(0, 2);
  return supportedLanguages[normalized] || "ko";
}

/**
 * 🎯 채팅 타입 확인
 *
 * @param {Object} chat - 텔레그램 채팅 객체
 * @returns {Object} 채팅 타입 정보
 */
function getChatInfo(chat) {
  if (!chat) {
    return {
      isPrivate: false,
      isGroup: false,
      isSupergroup: false,
      isChannel: false,
      type: "unknown",
    };
  }

  return {
    isPrivate: chat.type === "private",
    isGroup: chat.type === "group",
    isSupergroup: chat.type === "supergroup",
    isChannel: chat.type === "channel",
    type: chat.type,
    id: chat.id,
    title: chat.title || null,
  };
}

/**
 * 🎯 사용자 활동 로그 생성
 *
 * @param {Object} user - 텔레그램 사용자 객체
 * @param {string} action - 액션 타입
 * @param {Object} metadata - 추가 메타데이터
 * @returns {Object} 로그 객체
 */
function createUserActivityLog(user, action, metadata = {}) {
  return {
    timestamp: new Date().toISOString(),
    userId: user?.id || null,
    userName: getUserName(user),
    fullName: getFullUserName(user),
    username: user?.username || null,
    action: action,
    metadata: metadata,
    languageCode: user?.language_code || "unknown",
  };
}

/**
 * 🎯 개인정보 보호를 위한 사용자 익명화
 *
 * @param {Object} user - 텔레그램 사용자 객체
 * @returns {Object} 익명화된 사용자 정보
 */
function anonymizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    isBot: user.is_bot || false,
    languageCode: user.language_code || "ko",
    hasUsername: !!(user.username && user.username.trim()),
    hasFirstName: !!(user.first_name && user.first_name.trim()),
    hasLastName: !!(user.last_name && user.last_name.trim()),
    // 실제 이름이나 username은 포함하지 않음
  };
}

/**
 * 🎯 사용자 환영 메시지 생성
 *
 * @param {Object} user - 텔레그램 사용자 객체
 * @param {string} context - 컨텍스트 ("start", "help", "error" 등)
 * @returns {string} 환영 메시지
 */
function createWelcomeMessage(user, context = "start") {
  const userName = formatUserDisplay(user, "friendly"); // "이름님" 형태

  const messages = {
    start: [
      `안녕하세요 ${userName}! 🎉`,
      `${userName}, 어서오세요! 👋`,
      `${userName}! 두목봇이 도착했어요! 🚀`,
      `반갑습니다 ${userName}! ✨`,
      `${userName}, 환영합니다! 💫`,
    ],
    help: [
      `${userName}, 도움이 필요하시군요! 🤔`,
      `${userName}을 위한 도움말이에요! 📚`,
      `${userName}, 무엇을 도와드릴까요? 🛠️`,
    ],
    error: [
      `${userName}, 문제가 발생했어요! 😅`,
      `${userName}, 잠시 문제가 있네요! ⚠️`,
    ],
  };

  const contextMessages = messages[context] || messages.start;
  return contextMessages[Math.floor(Math.random() * contextMessages.length)];
}

// ⭐ Railway 환경변수에서 관리자 설정 로드
function getAdminIds() {
  const adminIds = process.env.ADMIN_USER_IDS || process.env.ADMIN_IDS || "";
  return adminIds
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id && !isNaN(id))
    .map((id) => parseInt(id))
    .filter((id) => id > 0);
}

// ⭐ Railway 환경변수에서 허용 사용자 설정 로드
function getAllowedIds() {
  const allowedIds =
    process.env.ALLOWED_USER_IDS || process.env.ALLOWED_IDS || "";
  if (!allowedIds) {
    return []; // 빈 배열 = 모든 사용자 허용
  }

  return allowedIds
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id && !isNaN(id))
    .map((id) => parseInt(id))
    .filter((id) => id > 0);
}

module.exports = {
  // ⭐ 기본 함수들 (가장 많이 사용)
  getUserName, // 기본 사용자 이름
  getFullUserName, // 전체 이름
  getUserMention, // 멘션 형태
  getShortUserName, // 짧은 이름 (@username 우선)

  // ⭐ 고급 함수들
  getUserSummary, // 사용자 정보 요약
  formatUserDisplay, // 다양한 형식으로 포맷
  createWelcomeMessage, // 환영 메시지 생성

  // ⭐ 권한 및 검증
  isValidUserId, // 사용자 ID 검증
  isAdmin, // 관리자 여부
  isAllowed, // 허용 사용자 여부
  getAdminIds, // 관리자 ID 목록
  getAllowedIds, // 허용 사용자 ID 목록

  // ⭐ 유틸리티
  normalizeLanguageCode, // 언어 코드 정규화
  getChatInfo, // 채팅 정보
  createUserActivityLog, // 활동 로그
  anonymizeUser, // 개인정보 익명화
};
