// scripts/debug-modules.js - 모듈 상태 디버깅 스크립트

require("dotenv").config();
const logger = require("../src/utils/Logger");

async function debugModules() {
  try {
    logger.info("🔍 모듈 디버깅 시작...");

    // 1. 서비스 파일 확인
    const fs = require("fs");
    const path = require("path");
    const servicesDir = path.join(__dirname, "..", "src", "services");

    logger.info("📁 서비스 디렉토리 확인:");
    if (fs.existsSync(servicesDir)) {
      const files = fs.readdirSync(servicesDir);
      files.forEach((file) => {
        logger.info(`   - ${file}`);
      });
    } else {
      logger.error("❌ services 디렉토리가 없습니다!");
    }

    // 2. TodoService 로드 테스트
    try {
      const TodoService = require("../src/services/TodoService");
      logger.success("✅ TodoService 로드 성공");
      logger.info(`   타입: ${typeof TodoService}`);
      logger.info(`   생성자명: ${TodoService.name}`);
    } catch (error) {
      logger.error("❌ TodoService 로드 실패:", error.message);
    }

    // 3. BaseModule 확인
    try {
      const BaseModule = require("../src/core/BaseModule");
      logger.success("✅ BaseModule 로드 성공");

      // requireService 메서드 확인
      const testModule = new BaseModule("TestModule", {});
      logger.info(
        `   requireService 메서드: ${typeof testModule.requireService}`
      );
    } catch (error) {
      logger.error("❌ BaseModule 로드 실패:", error.message);
    }

    // 4. 환경변수 확인
    logger.info("🔧 환경변수 확인:");
    logger.info(`   NODE_ENV: ${process.env.NODE_ENV}`);
    logger.info(`   BOT_TOKEN: ${process.env.BOT_TOKEN ? "설정됨" : "없음"}`);
    logger.info(`   MONGO_URL: ${process.env.MONGO_URL ? "설정됨" : "없음"}`);
    logger.info(
      `   RAILWAY_ENVIRONMENT: ${process.env.RAILWAY_ENVIRONMENT || "없음"}`
    );

    // 5. 모듈 파일 확인
    const modulesDir = path.join(__dirname, "..", "src", "modules");
    logger.info("📁 모듈 디렉토리 확인:");
    if (fs.existsSync(modulesDir)) {
      const files = fs.readdirSync(modulesDir);
      files.forEach((file) => {
        if (file.endsWith("Module.js")) {
          logger.info(`   - ${file}`);

          // 각 모듈의 setupActions 메서드 확인
          try {
            const ModuleClass = require(path.join(modulesDir, file));
            const testInstance = new ModuleClass(null, {});
            logger.info(
              `     setupActions: ${typeof testInstance.setupActions}`
            );
          } catch (e) {
            logger.error(`     로드 실패: ${e.message}`);
          }
        }
      });
    }
  } catch (error) {
    logger.error("❌ 디버깅 중 오류:", error);
  }
}

// 실행
debugModules();
