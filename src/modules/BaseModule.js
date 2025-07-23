// src/modules/BaseModule.js
const EventBus = require("../core/EventBus");
const DIContainer = require("../core/DIContainer");
const logger = require("../utils/Logger");

class BaseModule {
  constructor(name, options = {}) {
    this.name = name;
    this.container = options.container || require("../core/DIContainer");
    this.actionMap = new Map();
    this.setupActions();
  }
  // 의존성 가져오기
  getDependency(name) {
    return this.container.get(name);
  }
  // 🎯 기본 getDependency 메서드
  getDependency(name) {
    return DIContainer.get(name);
  }

  // 🎯 공통 getter들 추가
  get logger() {
    if (!this._logger) {
      this._logger = this.getDependency("logger");
    }
    return this._logger;
  }

  get timeHelper() {
    if (!this._timeHelper) {
      this._timeHelper = this.getDependency("timeHelper");
    }
    return this._timeHelper;
  }

  get userHelper() {
    if (!this._userHelper) {
      this._userHelper = this.getDependency("userHelper");
    }
    return this._userHelper;
  }

  get db() {
    if (!this._db) {
      this._db = this.getDependency("dbManager");
    }
    return this._db;
  }

  get bot() {
    if (!this._bot) {
      this._bot = this.getDependency("bot");
    }
    return this._bot;
  }
  // 서비스 헬퍼들
  get todoService() {
    return this.getDependency("todoService");
  }

  get weatherService() {
    return this.getDependency("weatherService");
  }

  get dbManager() {
    return this.getDependency("dbManager");
  }

  // 자식 클래스에서 오버라이드
  setupActions() {
    // 기본 액션들
    this.registerAction("menu", this.showMenu);
    this.registerAction("help", this.showHelp);
  }

  registerAction(name, handler) {
    this.actionMap.set(name, handler.bind(this));
  }

  // 의존성 주입
  getDependency(name) {
    if (!this.dependencies.has(name)) {
      this.dependencies.set(name, DIContainer.get(name));
    }
    return this.dependencies.get(name);
  }

  // 메시지 처리 가능 여부 체크
  canHandleMessage(msg) {
    // 자식 클래스에서 구현
    return false;
  }

  async handleMessage(msg) {
    try {
      // 자식 클래스에서 구현
      return false;
    } catch (error) {
      logger.error(`${this.name} 메시지 처리 오류:`, error);
      return false;
    }
  }

  async handleCallback(callbackQuery) {
    try {
      const [, action, ...params] = callbackQuery.data.split(":");

      const handler = this.actionMap.get(action);
      if (handler) {
        await handler(callbackQuery, params);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`${this.name} 콜백 처리 오류:`, error);
      return false;
    }
  }

  // 이벤트 발행 헬퍼
  emit(event, ...args) {
    EventBus.emit(`${this.name}:${event}`, ...args);
  }

  // 다른 모듈 이벤트 구독
  on(event, handler) {
    EventBus.on(event, handler.bind(this));
  }
}

module.exports = BaseModule;
