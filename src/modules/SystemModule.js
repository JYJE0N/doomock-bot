// src/modules/SystemModule.js - 안정화된 최종 버전

const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId } = require("../utils/UserHelper");
const { formatMemoryUsage, formatUptime } = require("../utils/SystemHelper");
const os = require("os");

class SystemModule extends BaseModule {
  // 🔥 핵심 수정: BaseModule 표준 매개변수 구조에 맞춤
  constructor(moduleName, options = {}) {
    // moduleName = "system"
    super(moduleName, options);

    // 시스템 모듈 특화 설정 (필요한 경우)
    this.systemConfig = {
      showDetailedStatus: true,
      enablePerformanceMonitoring: true,
      ...options.config,
    };
  }

  async onInitialize() {
    this.setupActions();
    logger.success("✅ SystemModule 초기화 완료.");
  }

  setupActions() {
    this.registerActions({
      help: this.showHelp,
      about: this.showAbout,
      status: this.showStatus,
    });
  }

  // 나머지 메서드들은 동일...
  async showHelp(bot, callbackQuery) {
    logger.info(
      `SystemModule: 도움말 요청 (사용자: ${getUserId(callbackQuery.from)})`
    );
    const text =
      `*도움말* ❓\n\n` +
      `두목봇은 다양한 기능을 제공하는 모듈형 봇입니다\\. \n` +
      `메인 메뉴에서 원하는 기능의 버튼을 눌러 시작하세요\\.`;
    return { module: "system", type: "help", text };
  }

  async showAbout(bot, callbackQuery) {
    logger.info(
      `SystemModule: 정보 요청 (사용자: ${getUserId(callbackQuery.from)})`
    );
    const text =
      `*두목봇 정보* ℹ️\n\n` +
      `*버전:* 3\\.0\\.1\n` +
      `*개발자:* 두몫\n` +
      `이 봇은 모듈식 아키텍처로 설계되어 확장 및 유지보수가 용이합니다\\.`;
    return { module: "system", type: "about", text };
  }

  async showStatus(bot, callbackQuery) {
    logger.info(
      `SystemModule: 상태 요청 (사용자: ${getUserId(callbackQuery.from)})`
    );
    const uptime = formatUptime(process.uptime() * 1000);
    const memory = formatMemoryUsage();

    const text =
      `*시스템 상태* 📊\n\n` +
      `*상태:* 정상 동작 중\n` +
      `*가동 시간:* ${uptime}\n` +
      `*메모리 사용량:* ${memory}\n` +
      `*Node\\.js:* ${process.version}\n` +
      `*플랫폼:* ${os.platform()}`;
    return { module: "system", type: "status", text };
  }
}

module.exports = SystemModule;
