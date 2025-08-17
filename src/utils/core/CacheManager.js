// src/utils/core/CacheManager.js - 통합 캐시 관리자
const logger = require("./Logger");

/**
 * 🗄️ CacheManager - 통합 메모리 캐시 관리 시스템
 * 
 * 특징:
 * - LRU (Least Recently Used) 정책
 * - TTL (Time To Live) 지원
 * - 메모리 사용량 모니터링
 * - 자동 정리 시스템
 * - 통계 및 분석
 */
class CacheManager {
  constructor(options = {}) {
    this.caches = new Map(); // namespace -> cache data
    this.config = {
      maxMemoryMB: options.maxMemoryMB || 50,           // 최대 50MB
      defaultTTL: options.defaultTTL || 300000,         // 기본 5분
      cleanupInterval: options.cleanupInterval || 60000, // 1분마다 정리
      maxEntriesPerNamespace: options.maxEntriesPerNamespace || 1000
    };

    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      cleanups: 0,
      memoryUsage: 0
    };

    // 자동 정리 시작
    this.startCleanupInterval();
    
    logger.info("🗄️ CacheManager 초기화 완료", {
      maxMemoryMB: this.config.maxMemoryMB,
      defaultTTL: this.config.defaultTTL
    });
  }

  /**
   * 네임스페이스별 캐시 생성/조회
   */
  getNamespace(namespace) {
    if (!this.caches.has(namespace)) {
      this.caches.set(namespace, {
        data: new Map(),
        accessTimes: new Map(), // LRU를 위한 접근 시간
        ttls: new Map(),        // TTL 관리
        stats: { hits: 0, misses: 0, sets: 0 }
      });
    }
    return this.caches.get(namespace);
  }

  /**
   * 값 설정
   */
  set(namespace, key, value, ttl = null) {
    const cache = this.getNamespace(namespace);
    const now = Date.now();
    const finalTTL = ttl || this.config.defaultTTL;

    // 크기 제한 확인
    if (cache.data.size >= this.config.maxEntriesPerNamespace) {
      this.evictLRU(cache);
    }

    cache.data.set(key, value);
    cache.accessTimes.set(key, now);
    cache.ttls.set(key, now + finalTTL);
    cache.stats.sets++;
    
    this.stats.sets++;
    this.updateMemoryStats();

    logger.debug(`🗄️ 캐시 설정: ${namespace}:${key} (TTL: ${finalTTL}ms)`);
  }

  /**
   * 값 조회
   */
  get(namespace, key) {
    const cache = this.getNamespace(namespace);
    
    if (!cache.data.has(key)) {
      cache.stats.misses++;
      this.stats.misses++;
      return null;
    }

    // TTL 확인
    const now = Date.now();
    const ttl = cache.ttls.get(key);
    if (ttl && now > ttl) {
      this.delete(namespace, key);
      cache.stats.misses++;
      this.stats.misses++;
      return null;
    }

    // LRU 업데이트
    cache.accessTimes.set(key, now);
    cache.stats.hits++;
    this.stats.hits++;

    const value = cache.data.get(key);
    logger.debug(`🗄️ 캐시 조회: ${namespace}:${key} (HIT)`);
    return value;
  }

  /**
   * 값 삭제
   */
  delete(namespace, key) {
    const cache = this.getNamespace(namespace);
    
    const deleted = cache.data.delete(key);
    cache.accessTimes.delete(key);
    cache.ttls.delete(key);
    
    if (deleted) {
      this.stats.deletes++;
      logger.debug(`🗄️ 캐시 삭제: ${namespace}:${key}`);
    }
    
    this.updateMemoryStats();
    return deleted;
  }

  /**
   * 네임스페이스 전체 삭제
   */
  clearNamespace(namespace) {
    if (this.caches.has(namespace)) {
      const cache = this.caches.get(namespace);
      const size = cache.data.size;
      this.caches.delete(namespace);
      logger.info(`🗄️ 네임스페이스 정리: ${namespace} (${size}개 항목)`);
      this.updateMemoryStats();
      return size;
    }
    return 0;
  }

  /**
   * LRU 제거
   */
  evictLRU(cache) {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, time] of cache.accessTimes.entries()) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      cache.data.delete(oldestKey);
      cache.accessTimes.delete(oldestKey);
      cache.ttls.delete(oldestKey);
      logger.debug(`🗄️ LRU 제거: ${oldestKey}`);
    }
  }

  /**
   * 만료된 항목 정리
   */
  cleanupExpired() {
    const now = Date.now();
    let totalCleaned = 0;

    for (const [namespace, cache] of this.caches.entries()) {
      let namespaceCleaned = 0;
      
      for (const [key, ttl] of cache.ttls.entries()) {
        if (now > ttl) {
          cache.data.delete(key);
          cache.accessTimes.delete(key);
          cache.ttls.delete(key);
          namespaceCleaned++;
        }
      }
      
      if (namespaceCleaned > 0) {
        logger.debug(`🧹 ${namespace}: ${namespaceCleaned}개 만료 캐시 정리`);
        totalCleaned += namespaceCleaned;
      }
    }

    if (totalCleaned > 0) {
      this.stats.cleanups++;
      this.updateMemoryStats();
      logger.debug(`🧹 총 ${totalCleaned}개 만료 캐시 정리 완료`);
    }

    return totalCleaned;
  }

  /**
   * 자동 정리 시작
   */
  startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
      this.checkMemoryUsage();
    }, this.config.cleanupInterval);
  }

  /**
   * 메모리 사용량 확인
   */
  checkMemoryUsage() {
    const memoryMB = this.getMemoryUsageMB();
    
    if (memoryMB > this.config.maxMemoryMB) {
      logger.warn(`🚨 캐시 메모리 한계 초과: ${memoryMB}MB > ${this.config.maxMemoryMB}MB`);
      
      // 강제 정리 - 각 네임스페이스에서 가장 오래된 25% 제거
      for (const [, cache] of this.caches.entries()) {
        const toRemove = Math.floor(cache.data.size * 0.25);
        for (let i = 0; i < toRemove; i++) {
          this.evictLRU(cache);
        }
      }
      
      logger.info(`🧹 메모리 정리 완료: ${this.getMemoryUsageMB()}MB`);
    }
  }

  /**
   * 메모리 사용량 계산 (대략적)
   */
  getMemoryUsageMB() {
    let totalEntries = 0;
    for (const cache of this.caches.values()) {
      totalEntries += cache.data.size;
    }
    
    // 대략적인 계산: 각 캐시 항목당 평균 1KB
    const estimatedMB = (totalEntries * 1024) / (1024 * 1024);
    this.stats.memoryUsage = estimatedMB;
    return estimatedMB;
  }

  /**
   * 메모리 통계 업데이트
   */
  updateMemoryStats() {
    this.getMemoryUsageMB();
  }

  /**
   * 통계 조회
   */
  getStats() {
    const namespaceStats = {};
    for (const [namespace, cache] of this.caches.entries()) {
      namespaceStats[namespace] = {
        entries: cache.data.size,
        ...cache.stats,
        hitRate: cache.stats.hits / (cache.stats.hits + cache.stats.misses) || 0
      };
    }

    return {
      global: {
        ...this.stats,
        hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
        memoryUsageMB: this.stats.memoryUsage,
        namespaces: Object.keys(namespaceStats).length
      },
      namespaces: namespaceStats
    };
  }

  /**
   * 정리
   */
  cleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    const totalEntries = Array.from(this.caches.values())
      .reduce((sum, cache) => sum + cache.data.size, 0);
    
    this.caches.clear();
    
    logger.info(`🗄️ CacheManager 정리 완료 (${totalEntries}개 항목)`);
  }

  /**
   * 싱글톤 인스턴스
   */
  static getInstance(options = {}) {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager(options);
    }
    return CacheManager.instance;
  }
}

// 싱글톤 인스턴스
CacheManager.instance = null;

module.exports = CacheManager;