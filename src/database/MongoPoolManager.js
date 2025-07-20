// src/database/MongoPoolManager.js - MongoDB 연결 풀링 관리자
const { MongoClient } = require('mongodb');
const Logger = require('../utils/Logger');

class MongoPoolManager {
  constructor() {
    this.client = null;
    this.db = null;
    this.isConnected = false;
    this.connectionString = process.env.MONGO_URL;
    
    // 📊 연결 풀 설정 (Railway 환경 최적화)
    this.poolOptions = {
      maxPoolSize: 10,        // 최대 연결 수
      minPoolSize: 2,         // 최소 연결 수
      maxIdleTimeMS: 30000,   // 30초 유휴 시간
      serverSelectionTimeoutMS: 5000, // 5초 서버 선택 타임아웃
      socketTimeoutMS: 45000, // 45초 소켓 타임아웃
      heartbeatFrequencyMS: 10000, // 10초 하트비트
      retryWrites: true,
      retryReads: true,
      connectTimeoutMS: 10000,
      bufferMaxEntries: 0,    // 버퍼링 비활성화 (즉시 에러)
    };

    // 📈 통계 추적
    this.stats = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      averageResponseTime: 0,
      lastConnected: null,
      reconnectCount: 0
    };

    this.queryTimes = [];
    this.maxQueryTimeHistory = 100;
  }

  // 🔗 데이터베이스 연결 (풀링 포함)
  async connect() {
    if (this.isConnected && this.client) {
      Logger.debug('이미 MongoDB에 연결되어 있음');
      return this.db;
    }

    try {
      Logger.info('🔗 MongoDB 연결 풀 초기화 중...');
      
      if (!this.connectionString) {
        throw new Error('MONGO_URL 환경변수가 설정되지 않았습니다');
      }

      // 기존 연결이 있다면 정리
      if (this.client) {
        await this.disconnect();
      }

      // 새 연결 생성
      this.client = new MongoClient(this.connectionString, this.poolOptions);
      await this.client.connect();
      
      // 연결 테스트
      await this.client.db('admin').command({ ping: 1 });
      
      this.db = this.client.db(); // 기본 데이터베이스 사용
      this.isConnected = true;
      this.stats.lastConnected = new Date();
      
      Logger.success(`✅ MongoDB 연결 풀 초기화 완료 (DB: ${this.db.databaseName})`);
      
      // 연결 이벤트 리스너 등록
      this.setupEventListeners();
      
      return this.db;
    } catch (error) {
      this.isConnected = false;
      Logger.error('❌ MongoDB 연결 실패:', error);
      throw error;
    }
  }

  // 📡 이벤트 리스너 설정
  setupEventListeners() {
    if (!this.client) return;

    this.client.on('serverOpening', () => {
      Logger.debug('🔓 MongoDB 서버 연결 열림');
    });

    this.client.on('serverClosed', () => {
      Logger.warn('🔒 MongoDB 서버 연결 닫힘');
    });

    this.client.on('error', (error) => {
      Logger.error('🚨 MongoDB 연결 오류:', error);
      this.isConnected = false;
    });

    this.client.on('timeout', () => {
      Logger.warn('⏰ MongoDB 연결 타임아웃');
    });
  }

  // 📊 연결 상태 확인
  async isHealthy() {
    try {
      if (!this.isConnected || !this.client) {
        return false;
      }

      // 빠른 핑 테스트
      const start = Date.now();
      await this.client.db('admin').command({ ping: 1 });
      const responseTime = Date.now() - start;
      
      Logger.debug(`💓 MongoDB 핑: ${responseTime}ms`);
      return responseTime < 1000; // 1초 이내 응답 정상
    } catch (error) {
      Logger.error('❌ MongoDB 상태 확인 실패:', error);
      return false;
    }
  }

  // 🔄 자동 재연결
  async reconnect() {
    Logger.info('🔄 MongoDB 재연결 시도...');
    this.stats.reconnectCount++;
    
    try {
      await this.disconnect();
      await this.connect();
      Logger.success('✅ MongoDB 재연결 성공');
      return true;
    } catch (error) {
      Logger.error('❌ MongoDB 재연결 실패:', error);
      return false;
    }
  }

  // 📋 컬렉션 접근 (안전한 방식)
  async getCollection(name) {
    try {
      if (!this.isConnected || !this.db) {
        await this.connect();
      }

      return this.db.collection(name);
    } catch (error) {
      Logger.error(`❌ 컬렉션 '${name}' 접근 실패:`, error);
      throw new Error(`컬렉션 접근 실패: ${error.message}`);
    }
  }

  // 🔍 통계가 포함된 쿼리 실행
  async executeQuery(collectionName, operation, ...args) {
    const startTime = Date.now();
    this.stats.totalQueries++;

    try {
      const collection = await this.getCollection(collectionName);
      const result = await collection[operation](...args);
      
      // 성공 통계 업데이트
      const queryTime = Date.now() - startTime;
      this.updateQueryStats(queryTime, true);
      
      Logger.debug(`✅ Query ${operation} on ${collectionName}: ${queryTime}ms`);
      return result;
    } catch (error) {
      // 실패 통계 업데이트
      const queryTime = Date.now() - startTime;
      this.updateQueryStats(queryTime, false);
      
      Logger.error(`❌ Query ${operation} on ${collectionName} 실패:`, error);
      
      // 연결 문제라면 재연결 시도
      if (this.isConnectionError(error)) {
        Logger.warn('🔄 연결 문제 감지, 재연결 시도...');
        await this.reconnect();
        
        // 한 번 더 시도
        try {
          const collection = await this.getCollection(collectionName);
          const result = await collection[operation](...args);
          this.stats.successfulQueries++;
          return result;
        } catch (retryError) {
          this.stats.failedQueries++;
          throw retryError;
        }
      }
      
      this.stats.failedQueries++;
      throw error;
    }
  }

  // 📊 쿼리 통계 업데이트
  updateQueryStats(queryTime, success) {
    if (success) {
      this.stats.successfulQueries++;
    } else {
      this.stats.failedQueries++;
    }

    // 응답 시간 추적
    this.queryTimes.push(queryTime);
    if (this.queryTimes.length > this.maxQueryTimeHistory) {
      this.queryTimes.shift();
    }

    // 평균 응답 시간 계산
    this.stats.averageResponseTime = 
      this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length;
  }

  // 🔌 연결 오류 판단
  isConnectionError(error) {
    const connectionErrors = [
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'MongoNetworkError',
      'MongoTimeoutError',
      'topology was destroyed'
    ];

    return connectionErrors.some(errorType => 
      error.message?.includes(errorType) || error.name?.includes(errorType)
    );
  }

  // 📈 상태 보고서
  getStats() {
    return {
      ...this.stats,
      isConnected: this.isConnected,
      poolSize: this.client?.topology?.s?.servers?.size || 0,
      databaseName: this.db?.databaseName || 'N/A',
      connectionString: this.connectionString?.replace(/\/\/.*@/, '//*****@') || 'N/A',
      successRate: this.stats.totalQueries > 0 
        ? ((this.stats.successfulQueries / this.stats.totalQueries) * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  // 🧹 연결 종료
  async disconnect() {
    try {
      if (this.client && this.isConnected) {
        Logger.info('🔌 MongoDB 연결 종료 중...');
        await this.client.close();
        this.isConnected = false;
        this.client = null;
        this.db = null;
        Logger.success('✅ MongoDB 연결 종료 완료');
      }
    } catch (error) {
      Logger.error('❌ MongoDB 연결 종료 실패:', error);
    }
  }

  // 🎯 간편한 CRUD 메서드들
  async findOne(collectionName, query, options = {}) {
    return this.executeQuery(collectionName, 'findOne', query, options);
  }

  async find(collectionName, query, options = {}) {
    const cursor = await this.executeQuery(collectionName, 'find', query, options);
    return cursor.toArray();
  }

  async insertOne(collectionName, document) {
    return this.executeQuery(collectionName, 'insertOne', {
      ...document,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  async updateOne(collectionName, filter, update, options = {}) {
    return this.executeQuery(collectionName, 'updateOne', filter, {
      $set: { ...update, updatedAt: new Date() }
    }, options);
  }

  async deleteOne(collectionName, filter) {
    return this.executeQuery(collectionName, 'deleteOne', filter);
  }

  async countDocuments(collectionName, query = {}) {
    return this.executeQuery(collectionName, 'countDocuments', query);
  }

  // 🔍 인덱스 관리
  async ensureIndexes(collectionName, indexes) {
    try {
      const collection = await this.getCollection(collectionName);
      
      for (const index of indexes) {
        await collection.createIndex(index.key, index.options || {});
        Logger.debug(`📑 인덱스 생성됨: ${collectionName}.${JSON.stringify(index.key)}`);
      }
    } catch (error) {
      Logger.error(`❌ 인덱스 생성 실패 (${collectionName}):`, error);
    }
  }

  // 🧼 데이터베이스 정리 (개발용)
  async cleanup() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('프로덕션 환경에서는 cleanup을 실행할 수 없습니다');
    }

    try {
      Logger.warn('🧼 데이터베이스 정리 시작...');
      const collections = await this.db.listCollections().toArray();
      
      for (const collection of collections) {
        await this.db.collection(collection.name).deleteMany({});
        Logger.debug(`🗑️ 컬렉션 정리됨: ${collection.name}`);
      }
      
      Logger.success('✅ 데이터베이스 정리 완료');
    } catch (error) {
      Logger.error('❌ 데이터베이스 정리 실패:', error);
      throw error;
    }
  }
}

// 싱글톤 인스턴스 생성
const mongoPoolManager = new MongoPoolManager();

module.exports = {
  MongoPoolManager,
  mongoPoolManager // 기본 인스턴스
};
