// src/utils/Logger.js - 한국시간 통합 표준 적용
// Railway 환경 v3.0.1 리팩토링 표준

const { getLogTimeString } = require("./KoreaTimeManager");

/**
 * 🖥️ 표준화된 로거 (한국시간 적용)
 * - Railway 환경에서 정확한 한국시간 로깅
 * - 싱글톤 패턴으로 일관성 보장
 * - 다양한 로그 레벨 지원
 */
class Logger {
  constructor() {
    if (Logger.instance) {
      return Logger.instance;
    }

    // 🎚️ 로그 레벨 설정
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      success: 4,
    };

    // 🎯 현재 로그 레벨 (환경변수에서 설정 가능)
    const envLevel = process.env.LOG_LEVEL?.toLowerCase();
    this.currentLevel = this.levels[envLevel] || this.levels.info;

    // 🎨 로그 레벨별 이모지
    this.emojis = {
      error: "❌",
      warn: "⚠️",
      info: "ℹ️",
      debug: "🐛",
      success: "✅",
    };

    // 🌈 색상 코드 (Railway 콘솔에서 보기 좋게)
    this.colors = {
      error: "\x1b[31m", // 빨간색
      warn: "\x1b[33m", // 노란색
      info: "\x1b[36m", // 청록색
      debug: "\x1b[35m", // 자주색
      success: "\x1b[32m", // 초록색
      reset: "\x1b[0m", // 리셋
    };

    // 📊 로그 통계
    this.stats = {
      totalLogs: 0,
      errorCount: 0,
      warnCount: 0,
      infoCount: 0,
      debugCount: 0,
      successCount: 0,
      startTime: Date.now(),
    };

    // 🚀 Railway 환경 감지
    this.isRailwayEnvironment = !!(
      process.env.RAILWAY_ENVIRONMENT ||
      process.env.RAILWAY_SERVICE_NAME ||
      process.env.RAILWAY_PROJECT_NAME
    );

    Logger.instance = this;
  }

  /**
   * 🎯 메인 로깅 메서드
   * @param {string} level - 로그 레벨
   * @param {...any} args - 로그 메시지 및 데이터
   */
  _log(level, ...args) {
    // 레벨 체크
    if (this.levels[level] > this.currentLevel) {
      return;
    }

    // 통계 업데이트
    this.stats.totalLogs++;
    this.stats[`${level}Count`]++;

    // 🇰🇷 한국시간 타임스탬프 (통합 표준 사용)
    const timestamp = getLogTimeString();

    // 이모지 및 색상
    const emoji = this.emojis[level] || "📝";
    const color = this.colors[level] || "";
    const reset = this.colors.reset;

    // Railway 환경에서는 색상 제거 (가독성 향상)
    if (this.isRailwayEnvironment) {
      console.log(`${emoji} [${timestamp}]`, ...args);
    } else {
      console.log(`${color}${emoji} [${timestamp}]${reset}`, ...args);
    }

    // 에러의 경우 스택 트레이스도 출력
    if (level === "error") {
      args.forEach((arg) => {
        if (arg instanceof Error && arg.stack) {
          console.log(`${color}📋 Stack Trace:${reset}`, arg.stack);
        }
      });
    }
  }

  // ==================== 🎯 로그 레벨별 메서드들 ====================

  /**
   * 정보 로그
   * @param {...any} args - 로그 내용
   */
  info(...args) {
    this._log("info", ...args);
  }

  /**
   * 에러 로그
   * @param {...any} args - 로그 내용
   */
  error(...args) {
    this._log("error", ...args);
  }

  /**
   * 경고 로그
   * @param {...any} args - 로그 내용
   */
  warn(...args) {
    this._log("warn", ...args);
  }

  /**
   * 디버그 로그
   * @param {...any} args - 로그 내용
   */
  debug(...args) {
    this._log("debug", ...args);
  }

  /**
   * 성공 로그
   * @param {...any} args - 로그 내용
   */
  success(...args) {
    this._log("success", ...args);
  }

  // ==================== 🔧 설정 메서드들 ====================

  /**
   * 로그 레벨 설정
   * @param {string} level - 설정할 로그 레벨
   */
  setLevel(level) {
    const newLevel = this.levels[level?.toLowerCase()];
    if (newLevel !== undefined) {
      this.currentLevel = newLevel;
      this.info(`🎚️ 로그 레벨 변경: ${level.toUpperCase()}`);
    } else {
      this.warn(`⚠️ 잘못된 로그 레벨: ${level}`);
    }
  }

  /**
   * 현재 로그 레벨 조회
   * @returns {string} 현재 로그 레벨
   */
  getLevel() {
    return Object.keys(this.levels)[this.currentLevel];
  }

  // ==================== 📊 유틸리티 메서드들 ====================

  /**
   * 로그 통계 조회
   * @returns {Object} 로그 통계 정보
   */
  getStats() {
    const uptime = Date.now() - this.stats.startTime;
    const uptimeSeconds = Math.floor(uptime / 1000);

    return {
      ...this.stats,
      uptime: uptimeSeconds,
      averageLogsPerSecond: (this.stats.totalLogs / uptimeSeconds).toFixed(2),
      currentLevel: this.getLevel(),
      railwayEnvironment: this.isRailwayEnvironment,
    };
  }

  /**
   * 상태 정보 조회 (하위 호환성)
   * @returns {Object} 상태 정보
   */
  getStatus() {
    return {
      initialized: true,
      level: this.getLevel(),
      totalLogs: this.stats.totalLogs,
      railwayEnvironment: this.isRailwayEnvironment,
    };
  }

  // ==================== 🔄 하위 호환성 메서드들 ====================

  /**
   * trace 메서드 (debug와 동일)
   * @param {...any} args - 로그 내용
   */
  trace(...args) {
    this._log("debug", ...args);
  }

  /**
   * 시간 정보 로깅 (하위 호환성)
   */
  logTimeInfo() {
    this.info("🕐 한국시간 정보 로딩 완료");
  }

  // ==================== 🎨 특별한 로깅 메서드들 ====================

  /**
   * 모듈 초기화 로그
   * @param {string} moduleName - 모듈명
   * @param {string} status - 상태 ('시작', '완료', '실패')
   */
  moduleLog(moduleName, status = "상태 업데이트") {
    const emoji = status.includes("완료")
      ? "✅"
      : status.includes("실패")
      ? "❌"
      : status.includes("시작")
      ? "🔧"
      : "📦";

    this.info(`${emoji} ${moduleName} ${status}`);
  }

  /**
   * 성능 로그 (실행 시간 측정)
   * @param {string} operation - 작업명
   * @param {number} startTime - 시작 시간 (Date.now())
   * @param {Object} additionalInfo - 추가 정보
   */
  performanceLog(operation, startTime, additionalInfo = {}) {
    const duration = Date.now() - startTime;
    const emoji = duration < 100 ? "⚡" : duration < 1000 ? "🔄" : "⏳";

    this.debug(`${emoji} ${operation} 완료 (${duration}ms)`, additionalInfo);
  }

  /**
   * Railway 환경 정보 로그
   */
  railwayInfo() {
    if (this.isRailwayEnvironment) {
      this.info("🚂 Railway 환경에서 실행 중");
      this.info("📍 배포 정보:", {
        deploymentId: process.env.RAILWAY_DEPLOYMENT_ID?.slice(0, 8) + "...",
        environment: process.env.RAILWAY_ENVIRONMENT,
        service: process.env.RAILWAY_SERVICE_NAME,
      });
    } else {
      this.info("💻 로컬 환경에서 실행 중");
    }
  }

  /**
   * 시작 로그 (앱 초기화 시 사용)
   * @param {string} appName - 앱 이름
   * @param {string} version - 버전
   */
  startupLog(appName, version) {
    this.info("🎬", "=".repeat(50));
    this.info(`🤖 ${appName} v${version} 시작`);
    this.railwayInfo();
    this.info("🕐 시간 기준: 한국 표준시 (UTC+9)");
    this.info("🎚️ 로그 레벨:", this.getLevel().toUpperCase());
    this.info("🎬", "=".repeat(50));
  }

  /**
   * 종료 로그 (앱 종료 시 사용)
   */
  shutdownLog() {
    const stats = this.getStats();
    this.info("🛑", "=".repeat(50));
    this.info("🛑 안전한 종료 진행 중...");
    this.info("📊 로그 통계:", {
      총로그: stats.totalLogs,
      에러: stats.errorCount,
      경고: stats.warnCount,
      가동시간: `${stats.uptime}초`,
    });
    this.info("🛑", "=".repeat(50));
  }
}

// ==================== 🌍 싱글톤 인스턴스 생성 ====================

const logger = new Logger();

// ==================== 📤 모듈 익스포트 ====================

module.exports = logger;
