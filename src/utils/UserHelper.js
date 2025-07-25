// src/utils/UserHelper.js - 사용자 헬퍼
const logger = require("./Logger");

/**
 * 👤 UserHelper - 사용자 정보 헬퍼
 *
 * 비유: 호텔의 컨시어지처럼
 * - 손님(사용자)의 정보를 기억하고
 * - 이름을 정확히 부르며
 * - 필요한 정보를 빠르게 찾아줍니다
 *
 * 특징:
 * - 텔레그램 사용자 정보 파싱
 * - 사용자명 표준화
 * - 권한 체크
 * - 사용자 상태 관리
 */
class UserHelper {
  constructor() {
    // 사용자 캐시 (메모리 캐시)
    this.userCache = new Map();

    // 캐시 TTL (5분)
    this.cacheTTL = 5 * 60 * 1000;

    // 관리자 목록 (환경변수에서 로드)
    this.adminIds = this.loadAdminIds();

    // 봇 ID (환경변수에서 로드)
    this.botId = process.env.BOT_ID || null;
  }

  /**
   * 관리자 ID 로드
   */
  loadAdminIds() {
    const adminIdsStr = process.env.ADMIN_IDS || "";
    return adminIdsStr
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id)
      .map((id) => parseInt(id));
  }

  /**
   * 메시지나 콜백쿼리에서 사용자 정보 추출
   */
  extractUser(msgOrQuery) {
    if (!msgOrQuery) return null;

    // 콜백쿼리인 경우
    if (msgOrQuery.from) {
      return msgOrQuery.from;
    }

    // 일반 메시지인 경우
    if (msgOrQuery.chat && msgOrQuery.chat.type === "private") {
      return msgOrQuery.chat;
    }

    // 그룹 메시지인 경우
    if (msgOrQuery.from) {
      return msgOrQuery.from;
    }

    return null;
  }

  /**
   * 사용자 ID 추출
   */
  getUserId(msgOrQuery) {
    const user = this.extractUser(msgOrQuery);
    return user ? user.id : null;
  }

  /**
   * 사용자 이름 가져오기 (표준화)
   */
  getUserName(msgOrQuery) {
    const user = this.extractUser(msgOrQuery);
    if (!user) return "알 수 없는 사용자";

    // 우선순위: first_name + last_name > username > id
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
  }

  /**
   * 사용자 전체 정보 가져오기
   */
  getUserInfo(msgOrQuery) {
    const user = this.extractUser(msgOrQuery);
    if (!user) return null;

    return {
      id: user.id,
      firstName: user.first_name || "",
      lastName: user.last_name || "",
      username: user.username || "",
      fullName: this.getUserName(msgOrQuery),
      languageCode: user.language_code || "ko",
      isBot: user.is_bot || false,
      isPremium: user.is_premium || false,
    };
  }

  /**
   * 채팅방 정보 가져오기
   */
  getChatInfo(msg) {
    if (!msg || !msg.chat) return null;

    const chat = msg.chat;
    return {
      id: chat.id,
      type: chat.type, // private, group, supergroup, channel
      title: chat.title || "",
      username: chat.username || "",
      firstName: chat.first_name || "",
      lastName: chat.last_name || "",
      isPrivate: chat.type === "private",
      isGroup: chat.type === "group" || chat.type === "supergroup",
      isChannel: chat.type === "channel",
    };
  }

  /**
   * 관리자 권한 확인
   */
  isAdmin(msgOrQuery) {
    const userId = this.getUserId(msgOrQuery);
    return userId && this.adminIds.includes(userId);
  }

  /**
   * 봇인지 확인
   */
  isBot(msgOrQuery) {
    const user = this.extractUser(msgOrQuery);
    return user && user.is_bot === true;
  }

  /**
   * 프리미엄 사용자인지 확인
   */
  isPremium(msgOrQuery) {
    const user = this.extractUser(msgOrQuery);
    return user && user.is_premium === true;
  }

  /**
   * 사용자 언어 가져오기
   */
  getUserLanguage(msgOrQuery) {
    const user = this.extractUser(msgOrQuery);
    return user?.language_code || "ko";
  }

  /**
   * 사용자 멘션 생성
   */
  getMention(msgOrQuery) {
    const user = this.extractUser(msgOrQuery);
    if (!user) return "";

    const name = user.first_name || `User#${user.id}`;
    return `[${name}](tg://user?id=${user.id})`;
  }

  /**
   * 사용자 링크 생성
   */
  getUserLink(msgOrQuery) {
    const user = this.extractUser(msgOrQuery);
    if (!user) return "";

    if (user.username) {
      return `https://t.me/${user.username}`;
    }

    return `tg://user?id=${user.id}`;
  }

  /**
   * 캐시에 사용자 정보 저장
   */
  cacheUser(userId, data) {
    this.userCache.set(userId, {
      data,
      timestamp: Date.now(),
    });

    // 오래된 캐시 정리
    this.cleanupCache();
  }

  /**
   * 캐시에서 사용자 정보 가져오기
   */
  getCachedUser(userId) {
    const cached = this.userCache.get(userId);
    if (!cached) return null;

    // TTL 확인
    if (Date.now() - cached.timestamp > this.cacheTTL) {
      this.userCache.delete(userId);
      return null;
    }

    return cached.data;
  }

  /**
   * 오래된 캐시 정리
   */
  cleanupCache() {
    const now = Date.now();

    for (const [userId, cached] of this.userCache.entries()) {
      if (now - cached.timestamp > this.cacheTTL) {
        this.userCache.delete(userId);
      }
    }
  }

  /**
   * 권한 레벨 가져오기
   */
  getPermissionLevel(msgOrQuery) {
    const userId = this.getUserId(msgOrQuery);
    if (!userId) return 0;

    // 관리자
    if (this.adminIds.includes(userId)) {
      return 100;
    }

    // 프리미엄 사용자
    if (this.isPremium(msgOrQuery)) {
      return 50;
    }

    // 일반 사용자
    return 10;
  }

  /**
   * 사용자 통계 정보
   */
  getUserStats(userId) {
    // 캐시된 통계 정보 반환
    const cached = this.getCachedUser(`stats_${userId}`);
    if (cached) return cached;

    // 기본 통계 구조
    const stats = {
      messageCount: 0,
      commandCount: 0,
      lastActivity: null,
      firstSeen: new Date(),
      totalUsageTime: 0,
    };

    this.cacheUser(`stats_${userId}`, stats);
    return stats;
  }

  /**
   * 사용자 활동 기록
   */
  recordActivity(msgOrQuery, activityType = "message") {
    const userId = this.getUserId(msgOrQuery);
    if (!userId) return;

    const stats = this.getUserStats(userId);

    // 활동 유형별 카운트 증가
    switch (activityType) {
      case "message":
        stats.messageCount++;
        break;
      case "command":
        stats.commandCount++;
        break;
    }

    stats.lastActivity = new Date();
    this.cacheUser(`stats_${userId}`, stats);
  }

  /**
   * 사용자 설정 기본값
   */
  getDefaultSettings() {
    return {
      language: "ko",
      timezone: "Asia/Seoul",
      notifications: {
        enabled: true,
        sound: true,
        vibration: true,
        quietHours: {
          enabled: false,
          start: "22:00",
          end: "08:00",
        },
      },
      privacy: {
        shareStats: true,
        publicProfile: false,
      },
    };
  }

  /**
   * 익명화된 사용자 ID 생성 (로깅용)
   */
  getAnonymousId(userId) {
    if (!userId) return "unknown";

    // 앞 3자리와 뒤 2자리만 표시
    const idStr = userId.toString();
    if (idStr.length <= 5) return idStr;

    return `${idStr.slice(0, 3)}***${idStr.slice(-2)}`;
  }

  /**
   * 사용자 검증
   */
  validateUser(msgOrQuery) {
    const user = this.extractUser(msgOrQuery);

    if (!user) {
      return { valid: false, reason: "사용자 정보 없음" };
    }

    if (user.is_bot && user.id !== this.botId) {
      return { valid: false, reason: "다른 봇의 메시지" };
    }

    return { valid: true };
  }
}

// 싱글톤 인스턴스
const userHelper = new UserHelper();

// 자주 사용하는 함수들 export
module.exports = {
  getUserId: (msgOrQuery) => userHelper.getUserId(msgOrQuery),
  getUserName: (msgOrQuery) => userHelper.getUserName(msgOrQuery),
  getUserInfo: (msgOrQuery) => userHelper.getUserInfo(msgOrQuery),
  getChatInfo: (msg) => userHelper.getChatInfo(msg),
  isAdmin: (msgOrQuery) => userHelper.isAdmin(msgOrQuery),
  getMention: (msgOrQuery) => userHelper.getMention(msgOrQuery),
  recordActivity: (msgOrQuery, type) =>
    userHelper.recordActivity(msgOrQuery, type),
  validateUser: (msgOrQuery) => userHelper.validateUser(msgOrQuery),
  helper: userHelper, // 전체 인스턴스 접근용
};
