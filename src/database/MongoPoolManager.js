const { MongoClient, ServerApiVersion } = require("mongodb");

class DatabaseManager {
  constructor(MONGO_URL = null) {
    this.MONGO_URL =
      MONGO_URL || process.env.MONGO_URL || process.env.MONGODB_URI;
    this.client = null;
    this.db = null;
    this.isConnected = false;
    this.isShuttingDown = false;
    this.connectionAttempts = 0;
    this.maxRetries = 5;
    this.reconnectInterval = null;

    const logger = this.getLogger();
    if (this.MONGO_URL) {
      logger.info("🗄️ DatabaseManager 초기화됨");
      logger.debug(
        `🔗 연결 대상: ${this.maskConnectionString(this.MONGO_URL)}`
      );
    } else {
      logger.warn("⚠️ MongoDB URL이 설정되지 않음");
    }
  }

  getLogger() {
    try {
      return require("../utils/Logger");
    } catch (error) {
      return {
        info: (...args) => console.log("[INFO]", ...args),
        error: (...args) => console.error("[ERROR]", ...args),
        warn: (...args) => console.warn("[WARN]", ...args),
        debug: (...args) => console.log("[DEBUG]", ...args),
        success: (...args) => console.log("[SUCCESS]", ...args),
      };
    }
  }

  maskConnectionString(connectionString) {
    if (!connectionString) return "N/A";
    return connectionString.replace(/\/\/[^:]+:[^@]+@/, "//***:***@");
  }

  getMongoOptions() {
    const isRailwayMongo = this.MONGO_URL?.includes("caboose.proxy.rlwy.net");

    const baseOptions = {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      maxPoolSize: isRailwayMongo ? 5 : 10,
      minPoolSize: isRailwayMongo ? 1 : 2,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: isRailwayMongo ? 15000 : 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: isRailwayMongo ? 15000 : 10000,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      retryReads: true,
      authSource: "admin",
      readPreference: "primary",
      compressors: ["zlib"],
    };

    const logger = this.getLogger();

    if (isRailwayMongo) {
      logger.info("🚂 Railway MongoDB 플러그인 감지");
      logger.debug("📊 Railway 최적화 옵션 적용");
    } else {
      logger.info("🌐 외부 MongoDB 서비스 감지");
      logger.debug("⚙️ 표준 연결 옵션 적용");
    }

    return baseOptions;
  }

  extractDbName(MONGO_URL) {
    try {
      const match = MONGO_URL.match(/\/([^/?]+)(\?|$)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  getDatabaseName() {
    const isRailwayMongo = this.MONGO_URL?.includes("caboose.proxy.rlwy.net");

    if (isRailwayMongo) {
      const dbNameFromUrl = this.extractDbName(this.MONGO_URL);
      return dbNameFromUrl || "doomock85";
    } else {
      const dbNameFromUrl = this.extractDbName(this.MONGO_URL);
      return this.sanitizeDbName(dbNameFromUrl) || "doomock85";
    }
  }

  sanitizeDbName(dbName) {
    if (!dbName) return "ddoomock85";

    let sanitized = dbName
      .replace(/\./g, "_")
      .replace(/\s+/g, "_")
      .replace(/[/\\:"*?<>|]/g, "")
      .replace(/^[._]+/, "")
      .replace(/[._]+$/, "")
      .toLowerCase();

    if (sanitized.length > 63) {
      sanitized = sanitized.substring(0, 63);
    }

    sanitized = sanitized.replace(/[._]+$/, "");

    if (!sanitized || sanitized.length === 0) {
      return "doomock85";
    }

    return sanitized;
  }

  async connect() {
    if (this.isShuttingDown) {
      throw new Error("데이터베이스가 종료 중입니다");
    }

    if (this.isConnected) {
      const logger = this.getLogger();
      logger.debug("✅ 이미 연결됨");
      return true;
    }

    if (!this.MONGO_URL) {
      throw new Error("MongoDB URL이 설정되지 않았습니다");
    }

    const logger = this.getLogger();
    this.connectionAttempts++;

    try {
      logger.info(
        `🔄 MongoDB 연결 시도 (${this.connectionAttempts}/${this.maxRetries})`
      );

      const mongoOptions = this.getMongoOptions();

      this.client = new MongoClient(this.MONGO_URL, mongoOptions);

      await this.client.connect();

      await this.client.db().admin().ping();

      const dbName = this.getDatabaseName();
      this.db = this.client.db(dbName);

      await this.db.admin().ping();

      this.isConnected = true;
      this.connectionAttempts = 0;

      logger.success(`✅ MongoDB 연결 성공!`);
      logger.info(`📂 데이터베이스: ${dbName}`);
      logger.debug(`🔗 서버: ${this.maskConnectionString(this.MONGO_URL)}`);

      this.startReconnectMonitoring();

      return true;
    } catch (error) {
      logger.error(
        `❌ MongoDB 연결 실패 (시도 ${this.connectionAttempts}):`,
        error.message
      );

      if (this.client) {
        try {
          await this.client.close();
        } catch (closeError) {
          logger.debug("클라이언트 정리 중 오류:", closeError.message);
        }
        this.client = null;
      }

      this.isConnected = false;

      if (this.connectionAttempts >= this.maxRetries) {
        throw new Error(`최대 재시도 횟수 초과 (${this.maxRetries})`);
      }

      throw error;
    }
  }

  startReconnectMonitoring() {
    if (this.reconnectInterval) return;

    const logger = this.getLogger();

    this.reconnectInterval = setInterval(async () => {
      if (this.isShuttingDown) return;

      try {
        if (this.client && this.isConnected) {
          await this.client.db().admin().ping();
        }
      } catch (error) {
        logger.warn("⚠️ 연결 상태 확인 실패, 재연결 시도:", error.message);
        this.isConnected = false;

        try {
          await this.connect();
        } catch (reconnectError) {
          logger.debug("⚠️ 재연결 실패, 계속 시도 중...");
        }
      }
    }, 15000);
  }

  stopReconnect() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
      const logger = this.getLogger();
      logger.info("⏹️ 재연결 중지");
    }
  }

  async ensureConnection() {
    if (this.isShuttingDown) {
      throw new Error("데이터베이스가 종료 중입니다");
    }

    if (!this.isConnected || !this.client) {
      const logger = this.getLogger();
      logger.info("🔄 연결이 끊어져 재연결 시도");
      return await this.connect();
    }

    try {
      await this.client.db().admin().ping();
      return true;
    } catch (error) {
      const logger = this.getLogger();
      logger.warn("⚠️ 연결 확인 실패, 재연결:", error.message);
      this.isConnected = false;
      return await this.connect();
    }
  }

  getCollection(collectionName) {
    if (!this.db) {
      throw new Error("데이터베이스가 연결되지 않았습니다");
    }
    return this.db.collection(collectionName);
  }

  async disconnect() {
    this.isShuttingDown = true;
    const logger = this.getLogger();

    try {
      this.stopReconnect();

      if (this.client) {
        logger.info("🔌 MongoDB 연결 종료 중...");
        await this.client.close(false);
        logger.info("✅ 데이터베이스 연결 종료");
      }

      this.client = null;
      this.db = null;
      this.isConnected = false;
    } catch (error) {
      logger.error("❌ 연결 종료 중 오류:", error.message);
    }
  }

  getStatus() {
    return {
      connected: this.isConnected,
      database: this.db ? this.db.databaseName : null,
      reconnecting: !!this.reconnectInterval,
      shuttingDown: this.isShuttingDown,
      connectionAttempts: this.connectionAttempts,
      hasClient: !!this.client,
      mongoUrl: this.MONGO_URL ? "설정됨" : "없음",
      railwayDetected:
        this.MONGO_URL?.includes("caboose.proxy.rlwy.net") || false,
    };
  }
}

module.exports = DatabaseManager;
