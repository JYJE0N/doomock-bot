// src/utils/Logger.js - v3.0.1 두목봇 전용 고급 로깅 시스템
const winston = require("winston");
const chalk = require("chalk");
const path = require("path");
const fs = require("fs");

/**
 * 🎨 두목봇 전용 고급 로깅 시스템 v3.0.1
 *
 * 🎯 특징:
 * - Winston + Chalk 조합으로 아름다운 로그 출력
 * - 기존 코드와 100% 호환성 보장
 * - Railway 환경 최적화
 * - 한국 시간 (KST) 지원
 * - 이모지 + 색상 조합으로 가독성 향상
 * - 싱글톤 패턴으로 메모리 효율성
 *
 * 📋 표준 매개변수:
 * - 모든 로그 메서드: (message, meta = {})
 * - 특수 로그: (operation, details = {})
 *
 * 🌟 비유: 로거는 집의 전등 시스템과 같습니다.
 * - 각 방(모듈)마다 적절한 조명(로그 레벨)을 제공
 * - 시간대별로 자동 조절(환경별 설정)
 * - 메인 스위치(Winston)와 조광기(Chalk)의 조합
 */
class AdvancedLogger {
  constructor() {
    // 싱글톤 패턴
    if (AdvancedLogger.instance) {
      return AdvancedLogger.instance;
    }

    // 🌍 환경 설정
    this.timezone = "Asia/Seoul";
    this.isDevelopment = process.env.NODE_ENV !== "production";
    this.isRailway = !!process.env.RAILWAY_ENVIRONMENT;
    this.logLevel =
      process.env.LOG_LEVEL || (this.isDevelopment ? "debug" : "info");

    // 🎨 색상 지원 강제 활성화 (Railway 환경에서도 색상 출력)
    if (process.env.FORCE_COLOR !== "0") {
      chalk.level = 3;
    }

    // 📁 로그 디렉토리 (Railway에서는 사용 안 함)
    this.logDir = this.isDevelopment && !this.isRailway ? "logs" : null;
    if (this.logDir) {
      this.ensureLogDirectory();
    }

    // 🎨 색상 테마 설정
    this.setupColorTheme();

    // 📊 이모지 매핑
    this.setupEmojis();

    // 📊 레벨 매핑 (기존 코드 호환성)
    this.setupLevels();

    // 🏗️ Winston 로거 생성
    this.winston = this.createWinstonLogger();

    // 📊 통계 초기화
    this.stats = {
      logsCount: 0,
      errorsCount: 0,
      warningsCount: 0,
      startTime: Date.now(),
    };

    AdvancedLogger.instance = this;

    // 🎉 초기화 완료 로그
    if (this.isDevelopment) {
      this.divider("=", 60);
      this.success("🎨 두목봇 Logger v3.0.1 초기화 완료", {
        winston: this.winston.transports.length + " transports",
        chalk: "level " + chalk.level,
        env: process.env.NODE_ENV || "development",
      });
      this.divider("=", 60);
    }
  }

  /**
   * 📁 로그 디렉토리 생성
   */
  ensureLogDirectory() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      console.warn("⚠️ 로그 디렉토리 생성 실패:", error.message);
    }
  }

  /**
   * 🎨 색상 테마 설정
   */
  setupColorTheme() {
    this.colors = {
      // 기본 레벨 색상
      error: chalk.bold.red,
      warn: chalk.bold.yellow,
      info: chalk.bold.cyan,
      debug: chalk.gray,
      success: chalk.bold.green,

      // 특수 요소 색상
      timestamp: chalk.dim.gray,
      module: chalk.bold.blue,
      user: chalk.bold.magenta,
      important: chalk.bold.bgRed.white,
      highlight: chalk.bold.bgYellow.black,

      // 데이터 색상
      number: chalk.yellow,
      string: chalk.green,
      boolean: chalk.blue,
      null: chalk.gray,
    };
  }

  /**
   * 📊 이모지 설정
   */
  setupEmojis() {
    this.emojis = {
      error: "❌",
      warn: "⚠️",
      info: "ℹ️",
      debug: "🐛",
      success: "✅",
      important: "🚨",
      highlight: "🌟",
      module: "📦",
      user: "👤",
      database: "🗄️",
      network: "🌐",
      file: "📄",
      timer: "⏱️",
      memory: "💾",
    };
  }

  /**
   * 📊 레벨 매핑 설정 (기존 코드 호환성)
   */
  setupLevels() {
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      success: 4,
    };
    this.currentLevel = this.levels[this.logLevel] || this.levels.info;
  }

  /**
   * 🏗️ Winston 로거 생성
   */
  createWinstonLogger() {
    const transports = this.createTransports();

    return winston.createLogger({
      level: "debug", // Winston은 항상 debug로, 필터링은 우리가 처리
      format: winston.format.combine(
        winston.format.timestamp({
          format: () => this.getKSTTimeString(),
        }),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports,
      exitOnError: false,
    });
  }

  /**
   * 🚛 Transport 생성 (중복 로깅 방지)
   */
  createTransports() {
    const transports = [];

    // 🖥️ 콘솔 Transport (중복 방지: 개발환경에서는 Winston 콘솔 비활성화)
    if (!this.isDevelopment && this.isRailway) {
      // Railway 환경: 간소화된 JSON 포맷
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp({
              format: () => this.getKSTTimeString().split(" ")[1], // 시간만
            }),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const emoji = this.getLevelEmoji(level);
              const metaStr = Object.keys(meta).length
                ? ` ${JSON.stringify(meta)}`
                : "";
              return `${timestamp} ${emoji} ${message}${metaStr}`;
            })
          ),
        })
      );
    } else {
      // 프로덕션 환경: JSON 포맷
      transports.push(
        new winston.transports.Console({
          format: winston.format.json(),
        })
      );
    }

    // 📄 파일 Transport (개발 환경에서만)
    if (this.logDir) {
      try {
        // 에러 로그 파일
        transports.push(
          new winston.transports.File({
            filename: path.join(this.logDir, "error.log"),
            level: "error",
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json()
            ),
          })
        );

        // 전체 로그 파일
        transports.push(
          new winston.transports.File({
            filename: path.join(this.logDir, "combined.log"),
            maxsize: 10485760, // 10MB
            maxFiles: 10,
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json()
            ),
          })
        );
      } catch (error) {
        console.warn("⚠️ 로그 파일 설정 실패:", error.message);
      }
    }

    return transports;
  }

  /**
   * 🕐 한국 시간 문자열 생성 (시간대 중복 적용 수정)
   */
  getKSTTimeString() {
    // 단순히 현재 로컬 시간 사용 (서버가 이미 KST로 설정됨)
    const now = new Date();
    return now.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  /**
   * 📊 로그 레벨별 이모지 반환
   */
  getLevelEmoji(level) {
    return this.emojis[level] || "📝";
  }

  /**
   * 🎯 핵심 로그 메서드 (중복 출력 방지)
   */
  _log(level, ...args) {
    // 레벨 체크
    if (this.levels[level] > this.currentLevel) return;

    // 통계 업데이트
    this.stats.logsCount++;
    if (level === "error") this.stats.errorsCount++;
    if (level === "warn") this.stats.warningsCount++;

    const timestamp = this.getKSTTimeString();
    const emoji = this.emojis[level] || "📝";
    const color = this.colors[level] || chalk.white;

    // 메시지와 메타데이터 분리
    let message = "";
    let meta = {};

    args.forEach((arg) => {
      if (typeof arg === "object" && arg !== null && !Array.isArray(arg)) {
        Object.assign(meta, arg);
      } else {
        message += (message ? " " : "") + String(arg);
      }
    });

    // 🎨 개발 환경에서만 컬러풀한 출력 (Winston 비활성화하여 중복 방지)
    if (this.isDevelopment) {
      const timestampStr = this.colors.timestamp(`[${timestamp}]`);
      const levelStr = color(level.toUpperCase().padEnd(7));

      // 메타데이터 포맷팅
      let metaStr = "";
      if (Object.keys(meta).length > 0) {
        const formattedMeta = [];
        for (const [key, value] of Object.entries(meta)) {
          if (key === "module") {
            formattedMeta.push(this.colors.module(`${key}:${value}`));
          } else if (key === "userId" || key === "userName") {
            formattedMeta.push(this.colors.user(`${key}:${value}`));
          } else {
            formattedMeta.push(chalk.gray(`${key}:${value}`));
          }
        }
        metaStr =
          chalk.gray(" {") +
          formattedMeta.join(chalk.gray(", ")) +
          chalk.gray("}");
      }

      console.log(`${emoji} ${timestampStr} ${levelStr} ${message}${metaStr}`);
    } else {
      // 프로덕션/Railway에서는 Winston만 사용
      this.winston.log(level === "success" ? "info" : level, message, meta);
    }
  }

  // ===== 🎯 기본 로그 메서드들 (100% 호환) =====

  /**
   * ❌ 에러 로그
   */
  error(message, meta = {}) {
    this._log("error", message, meta);
  }

  /**
   * ⚠️ 경고 로그
   */
  warn(message, meta = {}) {
    this._log("warn", message, meta);
  }

  /**
   * ℹ️ 정보 로그
   */
  info(message, meta = {}) {
    this._log("info", message, meta);
  }

  /**
   * 🐛 디버그 로그
   */
  debug(message, meta = {}) {
    this._log("debug", message, meta);
  }

  /**
   * ✅ 성공 로그
   */
  success(message, meta = {}) {
    this._log("success", message, meta);
  }

  // ===== 🎨 특수 로깅 메서드들 =====

  /**
   * 🚀 모듈 시작 로그 (박스 스타일)
   */
  moduleStart(moduleName, version = "") {
    const versionStr = version ? ` v${version}` : "";
    const text = `🚀 ${moduleName}${versionStr} 시작됨`;

    if (this.isDevelopment) {
      const boxWidth = text.length + 4;
      const top = "┌" + "─".repeat(boxWidth) + "┐";
      const middle = "│" + chalk.bold.white(` ${text} `.padEnd(boxWidth)) + "│";
      const bottom = "└" + "─".repeat(boxWidth) + "┘";

      console.log(chalk.blue(`\n${top}\n${middle}\n${bottom}\n`));
    }

    this.winston.info(`Module started: ${moduleName}${versionStr}`);
  }

  /**
   * 🛑 모듈 종료 로그
   */
  moduleStop(moduleName) {
    this.info(`🛑 ${moduleName} 종료됨`);
  }

  /**
   * 🚨 중요 알림
   */
  important(message, meta = {}) {
    if (this.isDevelopment) {
      const importantBox = this.colors.important(` 🚨 ${message} `);
      console.log(`\n${importantBox}\n`);
    }
    this.winston.warn(`🚨 ${message}`, { ...meta, logType: "important" });
  }

  /**
   * 🌟 하이라이트
   */
  highlight(message, meta = {}) {
    if (this.isDevelopment) {
      const highlighted = this.colors.highlight(` 🌟 ${message} `);
      console.log(highlighted);
    }
    this.winston.info(`🌟 ${message}`, { ...meta, logType: "highlight" });
  }

  /**
   * 📊 구분선
   */
  divider(char = "─", length = 50) {
    if (this.isDevelopment) {
      console.log(chalk.gray(char.repeat(length)));
    }
  }

  /**
   * 📋 테이블 출력
   */
  table(data, title = "") {
    if (title) {
      this.info(`📊 ${title}`);
    }

    if (Array.isArray(data) && data.length > 0) {
      if (this.isDevelopment) {
        console.table(data);
      }
      this.winston.info("Table displayed", {
        title,
        rowCount: data.length,
        columns: Object.keys(data[0] || {}),
      });
    } else {
      this.warn("테이블 데이터가 비어있습니다");
    }
  }

  /**
   * 📈 진행 상황 표시
   */
  progress(current, total, message = "") {
    const percentage = Math.round((current / total) * 100);

    if (this.isDevelopment) {
      const filled = Math.round(percentage / 5);
      const empty = 20 - filled;
      const bar =
        chalk.green("█".repeat(filled)) + chalk.gray("░".repeat(empty));
      const text = `${bar} ${chalk.bold(percentage + "%")} ${message}`;

      process.stdout.write(`\r${text}`);

      if (current === total) {
        console.log(""); // 줄바꿈
        this.success(`완료: ${message}`);
      }
    } else {
      // 프로덕션에서는 10% 단위로만 로그
      if (percentage % 10 === 0 || current === total) {
        this.info(`🔄 진행률: ${percentage}% ${message}`);
      }
    }
  }

  // ===== 📊 시스템 모니터링 메서드들 =====

  /**
   * 🌐 API 요청 로그
   */
  apiRequest(method, path, statusCode, duration) {
    const emoji = statusCode >= 400 ? "❌" : statusCode >= 300 ? "⚠️" : "✅";
    this.info(`${emoji} ${method} ${path} ${statusCode} (${duration}ms)`, {
      method,
      path,
      statusCode,
      duration,
    });
  }

  /**
   * 🗄️ 데이터베이스 연결 로그
   */
  dbConnection(dbName, status = "connected") {
    const emoji =
      status === "connected" ? "✅" : status === "error" ? "❌" : "⚠️";
    this.info(`${emoji} DB [${dbName}] ${status}`, {
      database: dbName,
      status,
    });
  }

  /**
   * ⏱️ 성능 측정 로그
   */
  performance(operation, startTime, details = {}) {
    const duration = Date.now() - startTime;
    const emoji = duration > 1000 ? "🐌" : duration > 500 ? "⚠️" : "⚡";

    this.info(`${emoji} ${operation} 완료 (${duration}ms)`, {
      operation,
      duration,
      ...details,
    });
  }

  /**
   * 💾 메모리 사용량 로그
   */
  memory() {
    const usage = process.memoryUsage();
    const formatMB = (bytes) => Math.round((bytes / 1024 / 1024) * 100) / 100;

    this.info("💾 메모리 사용량", {
      heap: `${formatMB(usage.heapUsed)}MB / ${formatMB(usage.heapTotal)}MB`,
      external: `${formatMB(usage.external)}MB`,
      rss: `${formatMB(usage.rss)}MB`,
    });

    if (this.isDevelopment) {
      console.table({
        "Heap Used": formatMB(usage.heapUsed) + " MB",
        "Heap Total": formatMB(usage.heapTotal) + " MB",
        External: formatMB(usage.external) + " MB",
        RSS: formatMB(usage.rss) + " MB",
      });
    }
  }

  /**
   * 👤 사용자 활동 로그
   */
  userActivity(userId, action, details = {}) {
    this.info(`👤 사용자 활동: ${action}`, {
      userId,
      action,
      timestamp: this.getKSTTimeString(),
      ...details,
    });
  }

  /**
   * 💚 시스템 상태 로그
   */
  systemStatus(component, status, details = {}) {
    const emoji =
      status === "healthy" ? "💚" : status === "warning" ? "💛" : "❤️";
    this.info(`${emoji} [${component}] ${status}`, {
      component,
      status,
      ...details,
    });
  }

  // ===== 🚂 Railway 전용 메서드들 =====

  /**
   * 🚂 Railway 배포 로그
   */
  railwayDeploy(version, environment) {
    this.important(`🚂 Railway 배포 완료 [${environment}] v${version}`, {
      version,
      environment,
      deployTime: this.getKSTTimeString(),
    });
  }

  /**
   * 🚂 Railway 환경 정보 로그
   */
  railwayEnvironment() {
    if (this.isRailway) {
      this.info("🚂 Railway 환경에서 실행 중", {
        service: process.env.RAILWAY_SERVICE_NAME,
        environment: process.env.RAILWAY_ENVIRONMENT,
        region: process.env.RAILWAY_REGION,
      });
    }
  }

  // ===== 🚨 에러 처리 전용 메서드들 =====

  /**
   * 💀 치명적 에러 로그 (프로세스 종료 고려)
   */
  fatal(message, error = null, shouldExit = false) {
    this.error(
      `💀 FATAL: ${message}`,
      error
        ? {
            error: error.message,
            stack: error.stack,
          }
        : {}
    );

    if (shouldExit) {
      process.exit(1);
    }
  }

  /**
   * 🛡️ 안전한 로그 (예외 없이)
   */
  safe(level, message, meta = {}) {
    try {
      this[level](message, meta);
    } catch (error) {
      console.error("로거 에러:", error);
      console.log(
        `[${this.getKSTTimeString()}] ${level.toUpperCase()}: ${message}`
      );
    }
  }

  // ===== 🔧 유틸리티 메서드들 =====

  /**
   * 📊 로그 레벨 변경
   */
  setLevel(level) {
    this.logLevel = level;
    this.currentLevel = this.levels[level] || this.levels.info;
    this.winston.level = level === "success" ? "info" : level;
    this.info(`📝 로그 레벨이 '${level}'로 변경됨`);
  }

  /**
   * 📋 로거 상태 정보
   */
  getStatus() {
    const uptime = Date.now() - this.stats.startTime;

    return {
      initialized: true,
      level: this.logLevel,
      timezone: this.timezone,
      isDevelopment: this.isDevelopment,
      isRailway: this.isRailway,
      logDir: this.logDir || "disabled",
      winston: {
        transports: this.winston.transports.length,
        level: this.winston.level,
      },
      chalk: {
        level: chalk.level,
        supportsColor: chalk.supportsColor,
      },
      stats: {
        ...this.stats,
        uptime: Math.round(uptime / 1000) + "s",
      },
    };
  }

  // ===== 🔄 기존 코드 호환성 메서드들 =====

  /**
   * 🔍 trace 메서드 (debug와 동일)
   */
  trace(message, meta = {}) {
    this.debug(message, meta);
  }

  /**
   * 🕐 시간 정보 로딩 완료 (기존 코드 호환)
   */
  logTimeInfo() {
    this.info("🕐 시간 정보 로딩 완료");
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
const logger = new AdvancedLogger();

module.exports = logger;

// ===== 📝 사용 예시 =====
/*
// 🎯 기본 사용법
logger.info("서버 시작됨");
logger.error("오류 발생", { error: "Database connection failed" });
logger.warn("경고", { userId: 12345, action: "invalidLogin" });
logger.success("작업 완료");

// 🎨 특수 로깅
logger.moduleStart("TodoModule", "1.0.0");
logger.important("긴급 공지사항");
logger.highlight("새로운 기능 추가");

// 📊 테이블 출력
logger.table([
  { module: "Todo", status: "active", users: 150 },
  { module: "Timer", status: "active", users: 89 }
], "모듈 현황");

// 📈 진행 상황
for (let i = 0; i <= 100; i += 10) {
  logger.progress(i, 100, "데이터 처리 중...");
  await new Promise(resolve => setTimeout(resolve, 100));
}

// ⏱️ 성능 측정
const start = Date.now();
// ... 작업 수행 ...
logger.performance("DB Query", start, { query: "SELECT * FROM users" });

// 💾 시스템 모니터링
logger.memory();
logger.systemStatus("Database", "healthy");
logger.userActivity(12345, "login", { ip: "192.168.1.1" });

// 🚂 Railway 전용
logger.railwayEnvironment();
logger.railwayDeploy("1.0.0", "production");

// 📋 상태 확인
console.log(logger.getStatus());
*/
