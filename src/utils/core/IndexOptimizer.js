// src/utils/core/IndexOptimizer.js - 데이터베이스 인덱스 최적화 도구
const logger = require("./Logger");

/**
 * 📊 IndexOptimizer - 데이터베이스 인덱스 성능 최적화 도구
 *
 * 특징:
 * - 쿼리 패턴 분석
 * - 인덱스 사용률 모니터링
 * - 자동 인덱스 최적화 제안
 * - 불필요한 인덱스 감지
 */
class IndexOptimizer {
  constructor() {
    this.queryStats = new Map();
    this.indexStats = new Map();
    this.slowQueries = [];

    logger.info("📊 IndexOptimizer 초기화 완료");
  }

  /**
   * 쿼리 실행 추적
   */
  trackQuery(collection, query, executionTime, indexUsed = null) {
    const queryKey = this.generateQueryKey(collection, query);

    if (!this.queryStats.has(queryKey)) {
      this.queryStats.set(queryKey, {
        collection,
        query,
        count: 0,
        totalTime: 0,
        avgTime: 0,
        slowCount: 0,
        indexesUsed: new Set()
      });
    }

    const stats = this.queryStats.get(queryKey);
    stats.count++;
    stats.totalTime += executionTime;
    stats.avgTime = stats.totalTime / stats.count;

    if (indexUsed) {
      stats.indexesUsed.add(indexUsed);
    }

    // 느린 쿼리 감지 (100ms 이상)
    if (executionTime > 100) {
      stats.slowCount++;
      this.slowQueries.push({
        collection,
        query,
        executionTime,
        timestamp: new Date(),
        indexUsed
      });

      // 최근 100개만 유지
      if (this.slowQueries.length > 100) {
        this.slowQueries = this.slowQueries.slice(-100);
      }
    }

    logger.debug(`📊 쿼리 추적: ${collection} (${executionTime}ms)`);
  }

  /**
   * 쿼리 키 생성
   */
  generateQueryKey(collection, query) {
    // 쿼리를 정규화하여 패턴 인식
    const normalized = this.normalizeQuery(query);
    return `${collection}:${JSON.stringify(normalized)}`;
  }

  /**
   * 쿼리 정규화 (값 제거, 구조만 남김)
   */
  normalizeQuery(query) {
    const normalize = (obj) => {
      if (Array.isArray(obj)) {
        return obj.map(normalize);
      }

      if (obj && typeof obj === "object") {
        const normalized = {};
        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === "object" && value !== null) {
            normalized[key] = normalize(value);
          } else {
            normalized[key] = typeof value; // 값 대신 타입만 저장
          }
        }
        return normalized;
      }

      return typeof obj;
    };

    return normalize(query);
  }

  /**
   * 인덱스 사용률 분석
   */
  async analyzeIndexUsage(mongoose) {
    try {
      const db = mongoose.connection.db;
      const collections = await db.listCollections().toArray();

      for (const collInfo of collections) {
        const collection = db.collection(collInfo.name);

        try {
          // 인덱스 통계 조회
          const indexStats = await collection
            .aggregate([{ $indexStats: {} }])
            .toArray();

          // 컬렉션 통계 조회
          const collStats = await collection.stats();

          this.indexStats.set(collInfo.name, {
            indexes: indexStats,
            totalDocuments: collStats.count || 0,
            avgDocSize: collStats.avgObjSize || 0,
            totalSize: collStats.size || 0
          });
        } catch (error) {
          logger.debug(
            `인덱스 통계 조회 실패: ${collInfo.name}`,
            error.message
          );
        }
      }

      logger.info("📊 인덱스 사용률 분석 완료");
      return this.generateIndexReport();
    } catch (error) {
      logger.error("인덱스 분석 실패:", error);
      return null;
    }
  }

  /**
   * 인덱스 보고서 생성
   */
  generateIndexReport() {
    const report = {
      summary: {
        totalQueries: Array.from(this.queryStats.values()).reduce(
          (sum, stat) => sum + stat.count,
          0
        ),
        slowQueries: this.slowQueries.length,
        avgQueryTime: this.calculateOverallAvgTime(),
        collections: this.indexStats.size
      },
      slowQueries: this.getTopSlowQueries(10),
      frequentQueries: this.getTopFrequentQueries(10),
      indexRecommendations: this.generateIndexRecommendations(),
      unusedIndexes: this.findUnusedIndexes()
    };

    return report;
  }

  /**
   * 전체 평균 쿼리 시간 계산
   */
  calculateOverallAvgTime() {
    const stats = Array.from(this.queryStats.values());
    const totalTime = stats.reduce((sum, stat) => sum + stat.totalTime, 0);
    const totalCount = stats.reduce((sum, stat) => sum + stat.count, 0);
    return totalCount > 0 ? totalTime / totalCount : 0;
  }

  /**
   * 가장 느린 쿼리 조회
   */
  getTopSlowQueries(limit = 10) {
    return this.slowQueries
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, limit)
      .map((query) => ({
        collection: query.collection,
        executionTime: query.executionTime,
        query: query.query,
        indexUsed: query.indexUsed,
        timestamp: query.timestamp
      }));
  }

  /**
   * 가장 빈번한 쿼리 조회
   */
  getTopFrequentQueries(limit = 10) {
    return Array.from(this.queryStats.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map((stat) => ({
        collection: stat.collection,
        query: stat.query,
        count: stat.count,
        avgTime: Math.round(stat.avgTime),
        slowCount: stat.slowCount,
        indexesUsed: Array.from(stat.indexesUsed)
      }));
  }

  /**
   * 인덱스 권장사항 생성
   */
  generateIndexRecommendations() {
    const recommendations = [];

    // 느린 쿼리 기반 권장사항
    for (const query of this.slowQueries) {
      if (!query.indexUsed || query.indexUsed === "COLLSCAN") {
        const queryFields = this.extractQueryFields(query.query);
        if (queryFields.length > 0) {
          recommendations.push({
            type: "create_index",
            collection: query.collection,
            fields: queryFields,
            reason: `느린 쿼리 최적화 (${query.executionTime}ms)`,
            priority: query.executionTime > 500 ? "high" : "medium"
          });
        }
      }
    }

    // 빈번한 쿼리 기반 권장사항
    for (const stat of Array.from(this.queryStats.values())) {
      if (stat.count > 100 && stat.avgTime > 50) {
        const queryFields = this.extractQueryFields(stat.query);
        if (queryFields.length > 0) {
          recommendations.push({
            type: "optimize_index",
            collection: stat.collection,
            fields: queryFields,
            reason: `빈번한 쿼리 최적화 (${stat.count}회 실행)`,
            priority: stat.count > 1000 ? "high" : "medium"
          });
        }
      }
    }

    return this.deduplicateRecommendations(recommendations);
  }

  /**
   * 쿼리에서 필드 추출
   */
  extractQueryFields(query) {
    const fields = [];

    const extractFromObject = (obj, prefix = "") => {
      for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith("$")) continue; // 연산자 제외

        const fieldName = prefix ? `${prefix}.${key}` : key;

        if (
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value)
        ) {
          extractFromObject(value, fieldName);
        } else {
          fields.push(fieldName);
        }
      }
    };

    if (typeof query === "object" && query !== null) {
      extractFromObject(query);
    }

    return fields.filter(
      (field, index, array) => array.indexOf(field) === index
    );
  }

  /**
   * 중복 권장사항 제거
   */
  deduplicateRecommendations(recommendations) {
    const seen = new Set();
    return recommendations.filter((rec) => {
      const key = `${rec.collection}:${rec.fields.join(",")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * 사용하지 않는 인덱스 찾기
   */
  findUnusedIndexes() {
    const unused = [];

    for (const [collection, stats] of this.indexStats.entries()) {
      for (const index of stats.indexes) {
        if (index.accesses?.ops === 0 && index.name !== "_id_") {
          unused.push({
            collection,
            indexName: index.name,
            indexSpec: index.spec || index.key,
            size: index.size || 0
          });
        }
      }
    }

    return unused;
  }

  /**
   * 통계 초기화
   */
  reset() {
    this.queryStats.clear();
    this.indexStats.clear();
    this.slowQueries.length = 0;
    logger.info("📊 IndexOptimizer 통계 초기화");
  }

  /**
   * 통계 조회
   */
  getStats() {
    return {
      queryCount: this.queryStats.size,
      totalExecutions: Array.from(this.queryStats.values()).reduce(
        (sum, stat) => sum + stat.count,
        0
      ),
      slowQueryCount: this.slowQueries.length,
      avgQueryTime: this.calculateOverallAvgTime(),
      collectionsAnalyzed: this.indexStats.size
    };
  }

  /**
   * 싱글톤 인스턴스
   */
  static getInstance() {
    if (!IndexOptimizer.instance) {
      IndexOptimizer.instance = new IndexOptimizer();
    }
    return IndexOptimizer.instance;
  }
}

// 싱글톤 인스턴스
IndexOptimizer.instance = null;

module.exports = IndexOptimizer;
