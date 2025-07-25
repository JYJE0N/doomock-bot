// src/core/DISetup.js
const DIContainer = require("./DIContainer");
const logger = require("../utils/Logger");

function setupDependencies(bot, config) {
  // Bot 인스턴스
  DIContainer.register("bot", () => bot, { singleton: true });

  // Config
  DIContainer.register("config", () => config, { singleton: true });

  // Database Manager
  DIContainer.register(
    "dbManager",
    (container) => {
      const DatabaseManager = require("../database/DatabaseManager");
      return new DatabaseManager(config.MONGO_URL);
    },
    { singleton: true }
  );

  // Module Loader
  DIContainer.register(
    "moduleLoader",
    (container) => {
      const ModuleLoader = require("./ModuleLoader");
      return new ModuleLoader();
    },
    { singleton: true }
  );

  // Services
  DIContainer.register(
    "todoService",
    (container) => {
      const TodoService = require("../services/TodoService");
      return new TodoService();
    },
    { singleton: true }
  );

  DIContainer.register(
    "weatherService",
    (container) => {
      const WeatherService = require("../services/WeatherService");
      return new WeatherService();
    },
    { singleton: true }
  );

  DIContainer.register(
    "timerService",
    (container) => {
      const TimerService = require("../services/TimerService");
      return new TimerService();
    },
    { singleton: true }
  );

  DIContainer.register(
    "reminderService",
    (container) => {
      const ReminderService = require("../services/ReminderService");
      return new ReminderService();
    },
    { singleton: true }
  );

  // 더 많은 서비스들...

  logger.info("✅ 의존성 주입 설정 완료");
}

module.exports = { setupDependencies };
