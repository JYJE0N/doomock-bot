// utils.js - 기본 유틸리티 함수들

// 한국 시간 가져오기
function getKoreaTime() {
    return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
}

// 현재 년도 가져오기
function getCurrentYear() {
    return getKoreaTime().getFullYear();
}

// 날짜 포맷팅 (YYYY-MM-DD)
function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('ko-KR');
}

// 시간 포맷팅 (HH:MM)
function formatTime(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleTimeString('ko-KR', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
    });
}

// 날짜와 시간 포맷팅
function formatDateTime(date) {
    if (!date) return '';
    return `${formatDate(date)} ${formatTime(date)}`;
}

// 숫자를 소수점 1자리까지 표시
function formatNumber(num, decimals = 1) {
    return parseFloat(num).toFixed(decimals);
}

// 퍼센트 계산
function calculatePercentage(used, total) {
    if (total === 0) return 0;
    return ((used / total) * 100).toFixed(1);
}

// 텍스트 자르기
function truncateText(text, maxLength = 100) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// 랜덤 선택
function randomChoice(array) {
    if (!Array.isArray(array) || array.length === 0) return null;
    return array[Math.floor(Math.random() * array.length)];
}

// 배열 섞기
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// 지연 함수
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 에러 로깅
function logError(error, context = '') {
    console.error(`[${getKoreaTime().toISOString()}] ${context}:`, error);
}

// 성공 로깅
function logSuccess(message, context = '') {
    console.log(`[${getKoreaTime().toISOString()}] ${context}: ${message}`);
}

// 유효한 숫자인지 확인
function isValidNumber(value) {
    return !isNaN(value) && isFinite(value) && value >= 0;
}

// 유효한 날짜인지 확인
function isValidDate(date) {
    return date instanceof Date && !isNaN(date);
}

// 모듈 내보내기
module.exports = {
    getKoreaTime,
    getCurrentYear,
    formatDate,
    formatTime,
    formatDateTime,
    formatNumber,
    calculatePercentage,
    truncateText,
    randomChoice,
    shuffleArray,
    delay,
    logError,
    logSuccess,
    isValidNumber,
    isValidDate
};
