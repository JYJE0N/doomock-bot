#!/bin/bash
# create-all-services.sh - 모든 서비스 생성

# 색상
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}🔧 모든 서비스 생성 스크립트${NC}"
echo "======================================"

# 백업
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="backup_services_${TIMESTAMP}"
mkdir -p "$BACKUP_DIR"

# 기존 서비스 백업
if [ -d "src/services" ]; then
  echo -e "${YELLOW}💾 기존 서비스 백업 중...${NC}"
  cp -r src/services "$BACKUP_DIR/" 2>/dev/null || true
  echo -e "${GREEN}✅ 백업 완료: $BACKUP_DIR${NC}"
fi

# 디렉토리 생성
mkdir -p src/services

# BaseService 생성
echo -e "\n${CYAN}📦 BaseService 생성 중...${NC}"
cat > "src/services/BaseService.js" << 'EOF'
// src/services/BaseService.js - 모든 서비스의 부모 클래스
const logger = require("../utils/Logger");

/**
 * 🏗️ BaseService - 모든 서비스의 기본 클래스
 * 
 * 제공 기능:
 * - DB/메모리 모드 전환
 * - 기본 CRUD 인터페이스
 * - 에러 처리
 */
class BaseService {
  constructor(collectionName) {
    this.collectionName = collectionName;
    this.collection = null;
    this.dbManager = null;
    this.memoryMode = false;
    this.memoryStorage = new Map();
    
    // 캐시
    this.cache = new Map();
    this.cacheTimeout = 300000; // 5분
    
    logger.debug(`🔧 BaseService 생성: ${collectionName}`);
  }

  /**
   * 초기화 (자식 클래스에서 구현)
   */
  async initialize() {
    throw new Error('initialize() must be implemented by child class');
  }

  /**
   * 캐시 관리
   */
  getCached(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  setCached(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.cache.clear();
  }

  /**
   * 정리
   */
  async cleanup() {
    this.clearCache();
    this.memoryStorage.clear();
    logger.info(`✅ ${this.collectionName} 서비스 정리 완료`);
  }

  /**
   * 상태 조회
   */
  getStatus() {
    return {
      collection: this.collectionName,
      mode: this.memoryMode ? 'memory' : 'database',
      memoryItems: this.memoryStorage.size,
      cacheItems: this.cache.size,
      connected: !this.memoryMode && !!this.collection
    };
  }
}

module.exports = BaseService;
EOF
echo -e "${GREEN}✅ BaseService.js 생성 완료${NC}"

# 서비스 정보
declare -A SERVICES=(
  ["Todo"]="📝:할일 관리:todo:todos"
  ["Reminder"]="⏰:리마인더:reminder:reminders"
  ["Worktime"]="🏢:퇴근계산기:worktime:worktimes"
  ["Leave"]="🏖️:연차계산기:leave:leaves"
  ["Timer"]="⏱️:집중타이머:timer:timers"
  ["Weather"]="🌤️:날씨:weather:weather_cache"
  ["Fortune"]="🔮:운세:fortune:fortunes"
  ["TTS"]="🔊:TTS:tts:tts_history"
)

# 각 서비스 생성
for SERVICE in "${!SERVICES[@]}"; do
  IFS=':' read -r ICON DESC KEY COLLECTION <<< "${SERVICES[$SERVICE]}"
  
  echo -e "\n${YELLOW}${ICON} ${SERVICE}Service 생성 중...${NC}"
  
  cat > "src/services/${SERVICE}Service.js" << EOF
// src/services/${SERVICE}Service.js - ${DESC} 서비스
const BaseService = require("./BaseService");
const logger = require("../utils/Logger");
const { ObjectId } = require("mongodb");

/**
 * 🔧 ${SERVICE}Service - ${DESC} 데이터 서비스
 * 
 * 주요 기능:
 * - 기본 CRUD (Create, Read, Update, Delete)
 * - 사용자별 데이터 관리
 * - 통계 조회
 */
class ${SERVICE}Service extends BaseService {
  constructor() {
    super("${COLLECTION}");
    
    // 서비스별 설정
    this.config = {
      maxItemsPerUser: 100,
      defaultPageSize: 10
    };
    
    logger.module('${SERVICE}Service', '🔧 서비스 생성됨');
  }

  /**
   * 🎯 서비스 초기화
   */
  async initialize() {
    try {
      logger.module('${SERVICE}Service', '📦 초기화 시작...');
      
      // DatabaseManager 연결 시도
      try {
        const { getInstance } = require("../database/DatabaseManager");
        this.dbManager = getInstance();
        
        if (this.dbManager && this.dbManager.db) {
          this.collection = this.dbManager.db.collection(this.collectionName);
          
          // 인덱스 생성
          await this.createIndexes();
          
          logger.success('✅ ${SERVICE}Service DB 연결 성공');
        } else {
          throw new Error('DatabaseManager not available');
        }
      } catch (dbError) {
        logger.warn('⚠️ ${SERVICE}Service 메모리 모드로 실행', dbError.message);
        this.memoryMode = true;
      }
      
    } catch (error) {
      logger.error('❌ ${SERVICE}Service 초기화 실패', error);
      this.memoryMode = true;
    }
  }

  /**
   * 🔍 인덱스 생성
   */
  async createIndexes() {
    try {
      await this.collection.createIndex({ userId: 1 });
      await this.collection.createIndex({ createdAt: -1 });
      await this.collection.createIndex({ userId: 1, createdAt: -1 });
      
      // 서비스별 추가 인덱스
      switch('${SERVICE}') {
        case 'Todo':
          await this.collection.createIndex({ 'status': 1 });
          await this.collection.createIndex({ 'priority': -1 });
          break;
        case 'Reminder':
          await this.collection.createIndex({ 'remindAt': 1 });
          await this.collection.createIndex({ 'recurring': 1 });
          break;
        case 'Worktime':
          await this.collection.createIndex({ 'date': -1 });
          await this.collection.createIndex({ 'userId': 1, 'date': -1 });
          break;
        case 'Leave':
          await this.collection.createIndex({ 'year': 1 });
          await this.collection.createIndex({ 'userId': 1, 'year': 1 });
          break;
      }
      
      logger.debug('🔍 ${SERVICE}Service 인덱스 생성 완료');
    } catch (error) {
      logger.error('인덱스 생성 실패', error);
    }
  }

  // ===== 🎯 기본 CRUD 메서드 =====

  /**
   * ➕ 생성
   */
  async create(userId, data) {
    try {
      const item = {
        _id: new ObjectId(),
        userId: userId.toString(),
        ...this.prepareData(data),
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      if (this.memoryMode) {
        this.memoryStorage.set(item._id.toString(), item);
        logger.debug('➕ 메모리에 저장됨', { id: item._id });
      } else {
        await this.collection.insertOne(item);
        logger.debug('➕ DB에 저장됨', { id: item._id });
      }
      
      // 캐시 무효화
      this.clearUserCache(userId);
      
      return {
        success: true,
        data: item,
        message: '생성되었습니다.'
      };
      
    } catch (error) {
      logger.error('생성 실패', error);
      return {
        success: false,
        error: error.message,
        message: '생성 중 오류가 발생했습니다.'
      };
    }
  }

  /**
   * 📋 목록 조회
   */
  async getList(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = this.config.defaultPageSize,
        status = null,
        sort = { createdAt: -1 }
      } = options;
      
      // 캐시 확인
      const cacheKey = \`list:\${userId}:\${page}:\${status}\`;
      const cached = this.getCached(cacheKey);
      if (cached) return cached;
      
      if (this.memoryMode) {
        // 메모리 모드
        let items = Array.from(this.memoryStorage.values())
          .filter(item => item.userId === userId.toString());
        
        if (status) {
          items = items.filter(item => item.status === status);
        }
        
        // 정렬
        items.sort((a, b) => b.createdAt - a.createdAt);
        
        const totalCount = items.length;
        const paginatedItems = items.slice((page - 1) * limit, page * limit);
        
        const result = {
          success: true,
          data: {
            items: paginatedItems,
            totalCount,
            page,
            totalPages: Math.ceil(totalCount / limit),
            hasNext: page * limit < totalCount,
            hasPrev: page > 1
          }
        };
        
        this.setCached(cacheKey, result);
        return result;
      }
      
      // DB 모드
      const query = { userId: userId.toString() };
      if (status) query.status = status;
      
      const totalCount = await this.collection.countDocuments(query);
      const items = await this.collection
        .find(query)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();
      
      const result = {
        success: true,
        data: {
          items,
          totalCount,
          page,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        }
      };
      
      this.setCached(cacheKey, result);
      return result;
      
    } catch (error) {
      logger.error('목록 조회 실패', error);
      return {
        success: false,
        error: error.message,
        data: { items: [], totalCount: 0, page: 1, totalPages: 0 }
      };
    }
  }

  /**
   * 🔍 단일 조회
   */
  async getById(userId, itemId) {
    try {
      // 캐시 확인
      const cacheKey = \`item:\${itemId}\`;
      const cached = this.getCached(cacheKey);
      if (cached) return cached;
      
      if (this.memoryMode) {
        const item = this.memoryStorage.get(itemId);
        if (item && item.userId === userId.toString()) {
          const result = { success: true, data: item };
          this.setCached(cacheKey, result);
          return result;
        }
        return { success: false, message: '항목을 찾을 수 없습니다.' };
      }
      
      const item = await this.collection.findOne({
        _id: new ObjectId(itemId),
        userId: userId.toString()
      });
      
      if (!item) {
        return { success: false, message: '항목을 찾을 수 없습니다.' };
      }
      
      const result = { success: true, data: item };
      this.setCached(cacheKey, result);
      return result;
      
    } catch (error) {
      logger.error('조회 실패', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * ✏️ 수정
   */
  async update(userId, itemId, updateData) {
    try {
      const updates = {
        ...updateData,
        updatedAt: new Date()
      };
      
      // status, _id, userId는 수정 불가
      delete updates._id;
      delete updates.userId;
      delete updates.createdAt;
      
      if (this.memoryMode) {
        const item = this.memoryStorage.get(itemId);
        if (item && item.userId === userId.toString()) {
          Object.assign(item, updates);
          this.clearUserCache(userId);
          return {
            success: true,
            data: item,
            message: '수정되었습니다.'
          };
        }
        return { success: false, message: '항목을 찾을 수 없습니다.' };
      }
      
      const result = await this.collection.findOneAndUpdate(
        {
          _id: new ObjectId(itemId),
          userId: userId.toString()
        },
        { \$set: updates },
        { returnDocument: 'after' }
      );
      
      if (!result.value) {
        return { success: false, message: '항목을 찾을 수 없습니다.' };
      }
      
      // 캐시 무효화
      this.clearUserCache(userId);
      this.cache.delete(\`item:\${itemId}\`);
      
      return {
        success: true,
        data: result.value,
        message: '수정되었습니다.'
      };
      
    } catch (error) {
      logger.error('수정 실패', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 🗑️ 삭제
   */
  async delete(userId, itemId) {
    try {
      if (this.memoryMode) {
        const item = this.memoryStorage.get(itemId);
        if (item && item.userId === userId.toString()) {
          this.memoryStorage.delete(itemId);
          this.clearUserCache(userId);
          return { success: true, message: '삭제되었습니다.' };
        }
        return { success: false, message: '항목을 찾을 수 없습니다.' };
      }
      
      const result = await this.collection.deleteOne({
        _id: new ObjectId(itemId),
        userId: userId.toString()
      });
      
      if (result.deletedCount === 0) {
        return { success: false, message: '항목을 찾을 수 없습니다.' };
      }
      
      // 캐시 무효화
      this.clearUserCache(userId);
      this.cache.delete(\`item:\${itemId}\`);
      
      return { success: true, message: '삭제되었습니다.' };
      
    } catch (error) {
      logger.error('삭제 실패', error);
      return { success: false, error: error.message };
    }
  }

  // ===== 📊 통계 메서드 =====

  /**
   * 📊 사용자 통계
   */
  async getUserStats(userId) {
    try {
      const cacheKey = \`stats:\${userId}\`;
      const cached = this.getCached(cacheKey);
      if (cached) return cached;
      
      if (this.memoryMode) {
        const items = Array.from(this.memoryStorage.values())
          .filter(item => item.userId === userId.toString());
        
        const stats = {
          total: items.length,
          active: items.filter(i => i.status === 'active').length,
          completed: items.filter(i => i.status === 'completed').length
        };
        
        const result = { success: true, data: stats };
        this.setCached(cacheKey, result);
        return result;
      }
      
      const pipeline = [
        { \$match: { userId: userId.toString() } },
        {
          \$group: {
            _id: '\$status',
            count: { \$sum: 1 }
          }
        }
      ];
      
      const results = await this.collection.aggregate(pipeline).toArray();
      
      const stats = {
        total: 0,
        active: 0,
        completed: 0
      };
      
      results.forEach(r => {
        stats[r._id] = r.count;
        stats.total += r.count;
      });
      
      const result = { success: true, data: stats };
      this.setCached(cacheKey, result);
      return result;
      
    } catch (error) {
      logger.error('통계 조회 실패', error);
      return {
        success: false,
        error: error.message,
        data: { total: 0, active: 0, completed: 0 }
      };
    }
  }

  /**
   * ⚙️ 사용자 설정
   */
  async getUserSettings(userId) {
    try {
      // TODO: 실제 설정 구현
      return {
        success: true,
        data: {
          notifications: true,
          autoSave: true,
          theme: 'default',
          language: 'ko'
        }
      };
    } catch (error) {
      return {
        success: false,
        data: {
          notifications: true,
          autoSave: true
        }
      };
    }
  }

  // ===== 🛠️ 유틸리티 메서드 =====

  /**
   * 데이터 준비 (서비스별 커스터마이징)
   */
  prepareData(data) {
    // 기본 데이터 준비
    const prepared = {
      title: data.title || '',
      description: data.description || ''
    };
    
    // 서비스별 추가 필드
    switch('${SERVICE}') {
      case 'Todo':
        prepared.priority = data.priority || 1;
        prepared.category = data.category || 'general';
        prepared.dueDate = data.dueDate || null;
        break;
      case 'Reminder':
        prepared.remindAt = data.remindAt || null;
        prepared.recurring = data.recurring || false;
        prepared.interval = data.interval || null;
        break;
      case 'Worktime':
        prepared.date = data.date || new Date();
        prepared.checkIn = data.checkIn || null;
        prepared.checkOut = data.checkOut || null;
        break;
      case 'Leave':
        prepared.year = data.year || new Date().getFullYear();
        prepared.type = data.type || 'annual';
        prepared.days = data.days || 0;
        break;
      case 'Timer':
        prepared.duration = data.duration || 25;
        prepared.type = data.type || 'pomodoro';
        prepared.completedAt = data.completedAt || null;
        break;
      case 'Weather':
        prepared.location = data.location || 'Seoul';
        prepared.data = data.data || null;
        prepared.cachedAt = new Date();
        break;
      case 'Fortune':
        prepared.date = data.date || new Date();
        prepared.type = data.type || 'daily';
        prepared.content = data.content || '';
        break;
      case 'TTS':
        prepared.text = data.text || '';
        prepared.voice = data.voice || 'default';
        prepared.speed = data.speed || 1.0;
        break;
    }
    
    return prepared;
  }

  /**
   * 사용자 캐시 초기화
   */
  clearUserCache(userId) {
    // 사용자 관련 모든 캐시 삭제
    for (const [key, value] of this.cache.entries()) {
      if (key.includes(userId.toString())) {
        this.cache.delete(key);
      }
    }
  }
}

module.exports = ${SERVICE}Service;
EOF

  echo -e "${GREEN}✅ ${SERVICE}Service.js 생성 완료${NC}"
done

# 최종 확인
echo -e "\n${BLUE}======================================"
echo -e "🎉 모든 서비스 생성 완료!"
echo -e "======================================${NC}"

echo -e "\n${GREEN}✅ 생성된 서비스:${NC}"
echo "  - src/services/BaseService.js (부모 클래스)"
for SERVICE in "${!SERVICES[@]}"; do
  echo "  - src/services/${SERVICE}Service.js"
done

echo -e "\n${CYAN}📋 각 서비스의 기능:${NC}"
echo "  • 기본 CRUD (Create, Read, Update, Delete)"
echo "  • 페이지네이션 지원"
echo "  • 캐싱 시스템"
echo "  • 메모리/DB 모드 자동 전환"
echo "  • 사용자별 통계"

echo -e "\n${YELLOW}🔗 서비스별 특화 기능:${NC}"
echo "  • TodoService: 우선순위, 카테고리, 마감일"
echo "  • ReminderService: 알림 시간, 반복 설정"
echo "  • WorktimeService: 출퇴근 시간 기록"
echo "  • LeaveService: 연차 타입, 잔여일수"
echo "  • TimerService: 타이머 타입, 지속시간"
echo "  • WeatherService: 위치, 캐시된 날씨 데이터"
echo "  • FortuneService: 운세 타입, 날짜별 관리"
echo "  • TTSService: 음성 설정, 변환 기록"

echo -e "\n${GREEN}✨ 서비스 생성 완료! ✨${NC}"