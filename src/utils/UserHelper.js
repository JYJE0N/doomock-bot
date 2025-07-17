// src/utils/UserHelper.js - 새로 생성

/**
 * 사용자 정보 관련 유틸리티 함수들
 */

/**
 * 텔레그램 사용자 객체에서 표시 이름을 추출
 * @param {Object} user - 텔레그램 사용자 객체
 * @returns {string} 사용자 표시 이름
 */
function getUserName(user) {
    if (!user) return '사용자';
    
    // 우선순위: first_name > username > id
    if (user.first_name) {
        return user.first_name;
    }
    
    if (user.username) {
        return user.username;
    }
    
    return `사용자${user.id}`;
}

/**
 * 전체 사용자 이름 생성 (first_name + last_name)
 * @param {Object} user - 텔레그램 사용자 객체
 * @returns {string} 전체 이름
 */
function getFullUserName(user) {
    if (!user) return '사용자';
    
    let fullName = '';
    
    if (user.first_name) {
        fullName += user.first_name;
    }
    
    if (user.last_name) {
        fullName += ' ' + user.last_name;
    }
    
    return fullName.trim() || getUserName(user);
}

/**
 * 사용자 멘션 텍스트 생성
 * @param {Object} user - 텔레그램 사용자 객체
 * @returns {string} 멘션 텍스트
 */
function getUserMention(user) {
    if (!user) return '사용자';
    
    const name = getUserName(user);
    
    if (user.username) {
        return `@${user.username}`;
    }
    
    return `[${name}](tg://user?id=${user.id})`;
}

/**
 * 사용자 정보 요약 생성
 * @param {Object} user - 텔레그램 사용자 객체
 * @returns {Object} 사용자 정보 요약
 */
function getUserSummary(user) {
    if (!user) {
        return {
            id: null,
            name: '사용자',
            username: null,
            fullName: '사용자',
            mention: '사용자',
            isBot: false
        };
    }
    
    return {
        id: user.id,
        name: getUserName(user),
        username: user.username || null,
        fullName: getFullUserName(user),
        mention: getUserMention(user),
        isBot: user.is_bot || false,
        languageCode: user.language_code || 'ko'
    };
}

/**
 * 사용자 ID 검증
 * @param {number} userId - 사용자 ID
 * @returns {boolean} 유효한 사용자 ID인지 여부
 */
function isValidUserId(userId) {
    return typeof userId === 'number' && userId > 0 && userId < 2147483647;
}

/**
 * 사용자 권한 확인
 * @param {Object} user - 텔레그램 사용자 객체
 * @param {Array} adminIds - 관리자 ID 배열
 * @returns {boolean} 관리자 권한 여부
 */
function isAdmin(user, adminIds = []) {
    if (!user || !Array.isArray(adminIds)) return false;
    return adminIds.includes(user.id);
}

/**
 * 사용자 블록 확인
 * @param {Object} user - 텔레그램 사용자 객체
 * @param {Array} blockedIds - 차단된 사용자 ID 배열
 * @returns {boolean} 차단된 사용자인지 여부
 */
function isBlocked(user, blockedIds = []) {
    if (!user || !Array.isArray(blockedIds)) return false;
    return blockedIds.includes(user.id);
}

/**
 * 사용자 허용 여부 확인
 * @param {Object} user - 텔레그램 사용자 객체
 * @param {Array} allowedIds - 허용된 사용자 ID 배열 (빈 배열이면 모든 사용자 허용)
 * @returns {boolean} 허용된 사용자인지 여부
 */
function isAllowed(user, allowedIds = []) {
    if (!user) return false;
    
    // 빈 배열이면 모든 사용자 허용
    if (allowedIds.length === 0) return true;
    
    return allowedIds.includes(user.id);
}

/**
 * 사용자 언어 코드 정규화
 * @param {string} languageCode - 언어 코드
 * @returns {string} 정규화된 언어 코드
 */
function normalizeLanguageCode(languageCode) {
    const supportedLanguages = {
        'ko': 'ko',
        'kr': 'ko',
        'en': 'en',
        'us': 'en',
        'ja': 'ja',
        'jp': 'ja',
        'zh': 'zh',
        'cn': 'zh',
        'es': 'es',
        'fr': 'fr',
        'de': 'de',
        'ru': 'ru'
    };
    
    if (!languageCode) return 'ko';
    
    const normalized = languageCode.toLowerCase().substring(0, 2);
    return supportedLanguages[normalized] || 'ko';
}

/**
 * 사용자 시간대 추정
 * @param {Object} user - 텔레그램 사용자 객체
 * @returns {string} 시간대 문자열
 */
function estimateUserTimezone(user) {
    if (!user) return 'Asia/Seoul';
    
    const timezoneMap = {
        'ko': 'Asia/Seoul',
        'ja': 'Asia/Tokyo',
        'zh': 'Asia/Shanghai',
        'en': 'America/New_York',
        'es': 'Europe/Madrid',
        'fr': 'Europe/Paris',
        'de': 'Europe/Berlin',
        'ru': 'Europe/Moscow'
    };
    
    const langCode = normalizeLanguageCode(user.language_code);
    return timezoneMap[langCode] || 'Asia/Seoul';
}

/**
 * 사용자 표시 형식 설정
 * @param {Object} user - 텔레그램 사용자 객체
 * @param {string} format - 표시 형식 ('short', 'long', 'mention')
 * @returns {string} 형식에 맞는 사용자 표시 이름
 */
function formatUserDisplay(user, format = 'short') {
    if (!user) return '사용자';
    
    switch (format) {
        case 'short':
            return getUserName(user);
        case 'long':
            return getFullUserName(user);
        case 'mention':
            return getUserMention(user);
        default:
            return getUserName(user);
    }
}

/**
 * 사용자 활동 로그 생성
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
        action: action,
        metadata: metadata,
        userAgent: user?.language_code || 'unknown'
    };
}

/**
 * 사용자 익명화 (개인정보 보호)
 * @param {Object} user - 텔레그램 사용자 객체
 * @returns {Object} 익명화된 사용자 정보
 */
function anonymizeUser(user) {
    if (!user) return null;
    
    return {
        id: user.id,
        isBot: user.is_bot || false,
        languageCode: user.language_code || 'ko',
        hasUsername: !!user.username,
        hasFirstName: !!user.first_name,
        hasLastName: !!user.last_name
    };
}

/**
 * 사용자 그룹 확인
 * @param {Object} chat - 텔레그램 채팅 객체
 * @returns {boolean} 그룹 채팅인지 여부
 */
function isGroupChat(chat) {
    return chat && (chat.type === 'group' || chat.type === 'supergroup');
}

/**
 * 사용자 개인 채팅 확인
 * @param {Object} chat - 텔레그램 채팅 객체
 * @returns {boolean} 개인 채팅인지 여부
 */
function isPrivateChat(chat) {
    return chat && chat.type === 'private';
}

module.exports = {
    getUserName,
    getFullUserName,
    getUserMention,
    getUserSummary,
    isValidUserId,
    isAdmin,
    isBlocked,
    isAllowed,
    normalizeLanguageCode,
    estimateUserTimezone,
    formatUserDisplay,
    createUserActivityLog,
    anonymizeUser,
    isGroupChat,
    isPrivateChat
};