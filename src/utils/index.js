/**
 * 🛠️ Utils - 최소한의 핵심 유틸리티
 * EventBus 기반 시스템에 필요한 필수 기능만 제공
 */

const Logger = require('./core/Logger');

/**
 * 간단하고 효율적인 유틸리티 클래스
 */
class Utils {
  // === 시간 관련 ===
  
  /**
   * 현재 한국 시간
   * @param {string} format 포맷 (기본: full)
   * @returns {string}
   */
  static now(format = 'full') {
    const date = new Date();
    
    switch (format) {
      case 'full':
        return date.toLocaleString('ko-KR', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
      case 'date':
        return date.toLocaleDateString('ko-KR');
      case 'time':
        return date.toLocaleTimeString('ko-KR');
      case 'iso':
        return date.toISOString();
      default:
        return date.toLocaleString('ko-KR');
    }
  }

  /**
   * 타임스탬프 생성
   * @returns {string}
   */
  static timestamp() {
    return new Date().toISOString();
  }

  /**
   * 딜레이
   * @param {number} ms 밀리초
   * @returns {Promise<void>}
   */
  static delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // === ID 생성 ===
  
  /**
   * 고유 ID 생성
   * @param {string} prefix 접두사
   * @returns {string}
   */
  static id(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 짧은 ID 생성
   * @param {string} prefix 접두사  
   * @returns {string}
   */
  static shortId(prefix = '') {
    const id = Math.random().toString(36).substr(2, 8);
    return prefix ? `${prefix}_${id}` : id;
  }

  // === 텍스트 처리 ===
  
  /**
   * 마크다운 특수문자 이스케이프
   * @param {string} text 텍스트
   * @returns {string}
   */
  static escape(text) {
    if (!text || typeof text !== 'string') return '';
    return text.replace(/[_*\[\]()~`>#+=|{}.!-]/g, '\\$&');
  }

  /**
   * 볼드 텍스트
   * @param {string} text 텍스트
   * @returns {string}
   */
  static bold(text) {
    return `*${this.escape(text)}*`;
  }

  /**
   * 이탤릭 텍스트  
   * @param {string} text 텍스트
   * @returns {string}
   */
  static italic(text) {
    return `_${this.escape(text)}_`;
  }

  /**
   * 코드 텍스트
   * @param {string} text 텍스트
   * @returns {string}
   */
  static code(text) {
    return `\`${text}\``;
  }

  // === 검증 ===
  
  /**
   * 빈 값 확인
   * @param {any} value 값
   * @returns {boolean}
   */
  static isEmpty(value) {
    return value === null || value === undefined || value === '';
  }

  /**
   * 문자열 길이 확인
   * @param {string} text 텍스트
   * @param {number} max 최대 길이
   * @returns {boolean}
   */
  static isValidLength(text, max = 1000) {
    return typeof text === 'string' && text.length > 0 && text.length <= max;
  }

  /**
   * 사용자 ID 검증
   * @param {any} userId 사용자 ID
   * @returns {boolean}
   */
  static isValidUserId(userId) {
    const num = Number(userId);
    return !isNaN(num) && num > 0 && Number.isInteger(num);
  }

  // === 유틸리티 ===

  /**
   * 배열에서 랜덤 선택
   * @param {Array} array 배열
   * @returns {any}
   */
  static randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * 실행 시간 측정
   * @param {Function} fn 함수
   * @param {string} label 라벨
   * @returns {Promise<any>}
   */
  static async measure(fn, label = 'Execution') {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;
    console.log(`⏱️ ${label}: ${duration}ms`);
    return result;
  }

  /**
   * 메모리 사용량
   * @returns {object}
   */
  static getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
      timestamp: this.now()
    };
  }

  // === 로거 접근 ===
  static Logger = Logger;

  /**
   * 로그 출력
   * @param {string} level 레벨
   * @param {string} message 메시지
   * @param {any} data 데이터
   */
  static log(level, message, data) {
    Logger[level](message, data);
  }
}

module.exports = Utils;