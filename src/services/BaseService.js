// src/services/BaseService.js - 모든 서비스의 부모 클래스
const logger = require("../utils/Logger");

class BaseService {
  constructor(collectionName) {
    this.collectionName = collectionName;
    this.collection = null;
    this.memoryMode = false;
    this.memoryStorage = new Map();
    
    logger.debug(`🔧 BaseService 생성: ${collectionName}`);
  }

  async initialize() {
    // 자식 클래스에서 구현
  }

  async cleanup() {
    this.memoryStorage.clear();
  }

  getStatus() {
    return {
      collection: this.collectionName,
      mode: this.memoryMode ? 'memory' : 'database',
      items: this.memoryStorage.size
    };
  }
}

module.exports = BaseService;
