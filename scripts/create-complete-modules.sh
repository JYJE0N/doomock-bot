#!/bin/bash
# create-complete-modules.sh - 모듈-서비스 생성 및 연결

# 색상
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# 타임스탬프
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo -e "${BLUE}🚀 모듈-서비스 완전 생성 스크립트${NC}"
echo "======================================"

# 백업 디렉토리
BACKUP_DIR="backup_${TIMESTAMP}"
mkdir -p "$BACKUP_DIR"/{modules,services,handlers,config}

# 기존 파일 백업
echo -e "${YELLOW}💾 기존 파일 백업 중...${NC}"
[ -d "src/modules" ] && cp -r src/modules/* "$BACKUP_DIR/modules/" 2>/dev/null || true
[ -d "src/services" ] && cp -r src/services/* "$BACKUP_DIR/services/" 2>/dev/null || true
[ -f "src/handlers/NavigationHandler.js" ] && cp src/handlers/NavigationHandler.js "$BACKUP_DIR/handlers/"
[ -f "src/config/menuConfig.js" ] && cp src/config/menuConfig.js "$BACKUP_DIR/config/"
echo -e "${GREEN}✅ 백업 완료: $BACKUP_DIR${NC}"

# 디렉토리 생성
mkdir -p src/{modules,services,config,handlers,core,utils}

# 모듈 정보
declare -A MODULES=(
  ["Todo"]="📝:할일 관리:todo"
  ["Reminder"]="⏰:리마인더:reminder"
  ["Worktime"]="🏢:퇴근계산기:worktime"
  ["Leave"]="🏖️:연차계산기:leave"
  ["Timer"]="⏱️:집중타이머:timer"
  ["Weather"]="🌤️:날씨:weather"
  ["Fortune"]="🔮:운세:fortune"
  ["TTS"]="🔊:TTS:tts"
)

echo -e "\n${MAGENTA}📦 BaseService 생성...${NC}"

# BaseService 생성
cat > "src/services/BaseService.js" << 'EOF'
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
EOF

echo -e "${GREEN}✅ BaseService 생성 완료${NC}"

# 각 모듈과 서비스 생성
for MODULE in "${!MODULES[@]}"; do
  IFS=':' read -r ICON DESC KEY <<< "${MODULES[$MODULE]}"
  
  echo -e "\n${YELLOW}${ICON} ${MODULE}Module & ${MODULE}Service 생성 중...${NC}"
  
  # 모듈 파일 생성 (서비스 연결 포함)
  cat > "src/modules/${MODULE}Module.js" << EOF
// src/modules/${MODULE}Module.js - ${DESC}
const BaseModule = require("../core/BaseModule");
const ${MODULE}Service = require("../services/${MODULE}Service");
const logger = require("../utils/Logger");
const { getUserName, getUserId } = require("../utils/UserHelper");

/**
 * ${ICON} ${MODULE}Module - ${DESC}
 * 
 * 특징:
 * - 서비스와 연결됨
 * - 데이터만 반환 (UI는 NavigationHandler)
 * - 심플한 CRUD 중심
 */
class ${MODULE}Module extends BaseModule {
  constructor(bot, options = {}) {
    super("${MODULE}Module", {
      bot,
      moduleManager: options.moduleManager,
      config: options.config
    });

    // 서비스 인스턴스
    this.${KEY}Service = null;
    
    logger.module('${MODULE}Module', '🚀 모듈 생성됨');
  }

  /**
   * 🎯 모듈 초기화 - 서비스 연결
   */
  async onInitialize() {
    try {
      logger.module('${MODULE}Module', '📦 초기화 시작...');
      
      // 서비스 생성 및 초기화
      this.${KEY}Service = new ${MODULE}Service();
      await this.${KEY}Service.initialize();
      
      logger.success('✅ ${MODULE}Module 초기화 완료');
    } catch (error) {
      logger.error('❌ ${MODULE}Module 초기화 실패', error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록
   */
  setupActions() {
    this.registerActions({
      menu: this.getMenuData,
      list: this.getListData,
      add: this.prepareAdd,
      edit: this.prepareEdit,
      delete: this.prepareDelete,
      'delete:confirm': this.confirmDelete,
      settings: this.getSettingsData,
      help: this.getHelpData
    });
    
    logger.module('${MODULE}Module', \`✅ \${this.actionMap.size}개 액션 등록\`);
  }

  // ===== 📊 데이터 메서드들 =====

  /**
   * 메뉴 데이터
   */
  async getMenuData(bot, callbackQuery, params, moduleManager) {
    const userId = getUserId(callbackQuery);
    const userName = getUserName(callbackQuery);
    
    try {
      // 서비스에서 통계 가져오기
      const stats = await this.${KEY}Service.getUserStats(userId);
      
      return {
        type: 'menu',
        module: '${KEY}',
        userName: userName,
        stats: stats.data || { total: 0, active: 0, completed: 0 }
      };
    } catch (error) {
      logger.error('메뉴 데이터 조회 실패', error);
      return {
        type: 'menu',
        module: '${KEY}',
        userName: userName,
        stats: { total: 0, active: 0, completed: 0 }
      };
    }
  }

  /**
   * 목록 데이터
   */
  async getListData(bot, callbackQuery, params, moduleManager) {
    const userId = getUserId(callbackQuery);
    const page = parseInt(params[0]) || 1;
    
    try {
      const result = await this.${KEY}Service.getList(userId, { page, limit: 10 });
      
      return {
        type: 'list',
        module: '${KEY}',
        items: result.data.items || [],
        page: result.data.page || 1,
        totalPages: result.data.totalPages || 1
      };
    } catch (error) {
      logger.error('목록 조회 실패', error);
      return {
        type: 'list',
        module: '${KEY}',
        items: [],
        page: 1,
        totalPages: 1
      };
    }
  }

  /**
   * 추가 준비
   */
  async prepareAdd(bot, callbackQuery, params, moduleManager) {
    const userId = getUserId(callbackQuery);
    
    this.setUserState(userId, {
      action: 'waiting_add_input',
      module: '${KEY}',
      timestamp: Date.now()
    });
    
    return {
      type: 'input_prompt',
      module: '${KEY}',
      inputType: 'add',
      prompt: '추가할 내용을 입력하세요.'
    };
  }

  /**
   * 수정 준비
   */
  async prepareEdit(bot, callbackQuery, params, moduleManager) {
    const userId = getUserId(callbackQuery);
    const itemId = params[0];
    
    this.setUserState(userId, {
      action: 'waiting_edit_input',
      module: '${KEY}',
      itemId: itemId,
      timestamp: Date.now()
    });
    
    return {
      type: 'input_prompt',
      module: '${KEY}',
      inputType: 'edit',
      prompt: '수정할 내용을 입력하세요.',
      itemId: itemId
    };
  }

  /**
   * 삭제 준비
   */
  async prepareDelete(bot, callbackQuery, params, moduleManager) {
    const userId = getUserId(callbackQuery);
    const itemId = params[0];
    
    try {
      const item = await this.${KEY}Service.getById(userId, itemId);
      
      return {
        type: 'confirm',
        module: '${KEY}',
        action: 'delete',
        itemId: itemId,
        itemTitle: item.data?.title || '항목'
      };
    } catch (error) {
      logger.error('삭제 준비 실패', error);
      return {
        type: 'error',
        module: '${KEY}',
        message: '항목을 찾을 수 없습니다.'
      };
    }
  }

  /**
   * 삭제 확인
   */
  async confirmDelete(bot, callbackQuery, params, moduleManager) {
    const userId = getUserId(callbackQuery);
    const itemId = params[0];
    
    try {
      await this.${KEY}Service.delete(userId, itemId);
      
      return {
        type: 'action_complete',
        module: '${KEY}',
        action: 'delete',
        success: true,
        message: '삭제되었습니다.'
      };
    } catch (error) {
      logger.error('삭제 실패', error);
      return {
        type: 'error',
        module: '${KEY}',
        message: '삭제 중 오류가 발생했습니다.'
      };
    }
  }

  /**
   * 설정 데이터
   */
  async getSettingsData(bot, callbackQuery, params, moduleManager) {
    const userId = getUserId(callbackQuery);
    
    try {
      const settings = await this.${KEY}Service.getUserSettings(userId);
      
      return {
        type: 'settings',
        module: '${KEY}',
        settings: settings.data || {
          notifications: true,
          autoSave: true
        }
      };
    } catch (error) {
      return {
        type: 'settings',
        module: '${KEY}',
        settings: {
          notifications: true,
          autoSave: true
        }
      };
    }
  }

  /**
   * 도움말 데이터
   */
  async getHelpData(bot, callbackQuery, params, moduleManager) {
    return {
      type: 'help',
      module: '${KEY}',
      features: [
        '항목 추가/수정/삭제',
        '목록 보기',
        '설정 변경'
      ],
      tips: [
        '버튼을 눌러 쉽게 사용하세요',
        '문제가 있으면 /start를 입력하세요'
      ]
    };
  }

  // ===== 💬 메시지 처리 =====

  /**
   * 메시지 처리
   */
  async onHandleMessage(bot, msg) {
    const userId = getUserId(msg);
    const userState = this.getUserState(userId);
    
    if (!userState) return false;
    
    switch (userState.action) {
      case 'waiting_add_input':
        return await this.handleAddInput(bot, msg);
      case 'waiting_edit_input':
        return await this.handleEditInput(bot, msg);
      default:
        return false;
    }
  }

  /**
   * 추가 입력 처리
   */
  async handleAddInput(bot, msg) {
    const userId = getUserId(msg);
    const text = msg.text;
    
    try {
      const result = await this.${KEY}Service.create(userId, {
        title: text,
        description: ''
      });
      
      this.clearUserState(userId);
      
      return {
        type: 'add_complete',
        module: '${KEY}',
        success: result.success,
        itemTitle: text,
        chatId: msg.chat.id
      };
    } catch (error) {
      logger.error('추가 실패', error);
      this.clearUserState(userId);
      
      return {
        type: 'add_complete',
        module: '${KEY}',
        success: false,
        message: '추가 중 오류가 발생했습니다.',
        chatId: msg.chat.id
      };
    }
  }

  /**
   * 수정 입력 처리
   */
  async handleEditInput(bot, msg) {
    const userId = getUserId(msg);
    const userState = this.getUserState(userId);
    const itemId = userState.itemId;
    const text = msg.text;
    
    try {
      const result = await this.${KEY}Service.update(userId, itemId, {
        title: text
      });
      
      this.clearUserState(userId);
      
      return {
        type: 'edit_complete',
        module: '${KEY}',
        success: result.success,
        itemTitle: text,
        chatId: msg.chat.id
      };
    } catch (error) {
      logger.error('수정 실패', error);
      this.clearUserState(userId);
      
      return {
        type: 'edit_complete',
        module: '${KEY}',
        success: false,
        message: '수정 중 오류가 발생했습니다.',
        chatId: msg.chat.id
      };
    }
  }

  /**
   * 모듈 정리
   */
  async cleanup() {
    try {
      if (this.${KEY}Service) {
        await this.${KEY}Service.cleanup();
      }
      await super.cleanup();
      logger.info('✅ ${MODULE}Module 정리 완료');
    } catch (error) {
      logger.error('❌ ${MODULE}Module 정리 실패', error);
    }
  }
}

module.exports = ${MODULE}Module;
EOF

  # 서비스 파일 생성
  cat > "src/services/${MODULE}Service.js" << EOF
// src/services/${MODULE}Service.js - ${DESC} 서비스
const BaseService = require("./BaseService");
const logger = require("../utils/Logger");
const { ObjectId } = require("mongodb");

/**
 * 🔧 ${MODULE}Service - ${DESC} 데이터 서비스
 * 
 * 심플한 CRUD 구현
 */
class ${MODULE}Service extends BaseService {
  constructor() {
    super("${KEY}s");
    
    logger.module('${MODULE}Service', '🔧 서비스 생성됨');
  }

  /**
   * 🎯 서비스 초기화
   */
  async initialize() {
    try {
      logger.module('${MODULE}Service', '📦 초기화 시작...');
      
      // DatabaseManager 연결
      try {
        const { getInstance } = require("../database/DatabaseManager");
        const dbManager = getInstance();
        
        if (dbManager && dbManager.db) {
          this.collection = dbManager.db.collection(this.collectionName);
          
          // 인덱스 생성
          await this.createIndexes();
          
          logger.success('✅ ${MODULE}Service DB 연결 성공');
        } else {
          throw new Error('DB 연결 실패');
        }
      } catch (error) {
        logger.warn('⚠️ ${MODULE}Service 메모리 모드로 실행');
        this.memoryMode = true;
      }
      
    } catch (error) {
      logger.error('❌ ${MODULE}Service 초기화 실패', error);
      this.memoryMode = true;
    }
  }

  /**
   * 인덱스 생성
   */
  async createIndexes() {
    try {
      await this.collection.createIndex({ userId: 1 });
      await this.collection.createIndex({ createdAt: -1 });
      await this.collection.createIndex({ userId: 1, createdAt: -1 });
    } catch (error) {
      logger.error('인덱스 생성 실패', error);
    }
  }

  // ===== 🎯 기본 CRUD =====

  /**
   * 생성
   */
  async create(userId, data) {
    try {
      const item = {
        _id: new ObjectId(),
        userId: userId.toString(),
        title: data.title || '',
        description: data.description || '',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      if (this.memoryMode) {
        this.memoryStorage.set(item._id.toString(), item);
      } else {
        await this.collection.insertOne(item);
      }
      
      return { success: true, data: item };
    } catch (error) {
      logger.error('생성 실패', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 목록 조회
   */
  async getList(userId, options = {}) {
    try {
      const { page = 1, limit = 10 } = options;
      
      if (this.memoryMode) {
        const items = Array.from(this.memoryStorage.values())
          .filter(item => item.userId === userId.toString());
        
        return {
          success: true,
          data: {
            items: items.slice((page - 1) * limit, page * limit),
            totalCount: items.length,
            page,
            totalPages: Math.ceil(items.length / limit)
          }
        };
      }
      
      const query = { userId: userId.toString() };
      const totalCount = await this.collection.countDocuments(query);
      const items = await this.collection
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();
      
      return {
        success: true,
        data: {
          items,
          totalCount,
          page,
          totalPages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error('목록 조회 실패', error);
      return { success: false, error: error.message, data: { items: [] } };
    }
  }

  /**
   * 단일 조회
   */
  async getById(userId, itemId) {
    try {
      if (this.memoryMode) {
        const item = this.memoryStorage.get(itemId);
        if (item && item.userId === userId.toString()) {
          return { success: true, data: item };
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
      
      return { success: true, data: item };
    } catch (error) {
      logger.error('조회 실패', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 수정
   */
  async update(userId, itemId, updateData) {
    try {
      const updates = {
        ...updateData,
        updatedAt: new Date()
      };
      
      if (this.memoryMode) {
        const item = this.memoryStorage.get(itemId);
        if (item && item.userId === userId.toString()) {
          Object.assign(item, updates);
          return { success: true, data: item };
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
      
      return { success: true, data: result.value };
    } catch (error) {
      logger.error('수정 실패', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 삭제
   */
  async delete(userId, itemId) {
    try {
      if (this.memoryMode) {
        const item = this.memoryStorage.get(itemId);
        if (item && item.userId === userId.toString()) {
          this.memoryStorage.delete(itemId);
          return { success: true };
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
      
      return { success: true };
    } catch (error) {
      logger.error('삭제 실패', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 사용자 통계
   */
  async getUserStats(userId) {
    try {
      if (this.memoryMode) {
        const items = Array.from(this.memoryStorage.values())
          .filter(item => item.userId === userId.toString());
        
        return {
          success: true,
          data: {
            total: items.length,
            active: items.filter(i => i.status === 'active').length,
            completed: items.filter(i => i.status === 'completed').length
          }
        };
      }
      
      const query = { userId: userId.toString() };
      const total = await this.collection.countDocuments(query);
      const active = await this.collection.countDocuments({ ...query, status: 'active' });
      const completed = await this.collection.countDocuments({ ...query, status: 'completed' });
      
      return {
        success: true,
        data: { total, active, completed }
      };
    } catch (error) {
      logger.error('통계 조회 실패', error);
      return { success: false, data: { total: 0, active: 0, completed: 0 } };
    }
  }

  /**
   * 사용자 설정
   */
  async getUserSettings(userId) {
    // TODO: 설정 구현
    return {
      success: true,
      data: {
        notifications: true,
        autoSave: true
      }
    };
  }
}

module.exports = ${MODULE}Service;
EOF

  echo -e "${GREEN}✅ ${MODULE}Module.js & ${MODULE}Service.js 생성 완료${NC}"
done

# 완료 메시지
echo -e "\n${BLUE}======================================"
echo -e "🎉 모든 모듈-서비스 생성 완료!"
echo -e "======================================${NC}"

echo -e "\n${GREEN}✅ 생성된 파일:${NC}"
echo "📁 Modules:"
for MODULE in "${!MODULES[@]}"; do
  echo "  - src/modules/${MODULE}Module.js"
done
echo ""
echo "📁 Services:"
echo "  - src/services/BaseService.js"
for MODULE in "${!MODULES[@]}"; do
  echo "  - src/services/${MODULE}Service.js"
done

echo -e "\n${CYAN}🔗 모듈-서비스 연결 상태:${NC}"
for MODULE in "${!MODULES[@]}"; do
  IFS=':' read -r ICON DESC KEY <<< "${MODULES[$MODULE]}"
  echo -e "  ${ICON} ${MODULE}Module ↔️ ${MODULE}Service ✅"
done

echo -e "\n${YELLOW}📋 다음 단계:${NC}"
echo "1. NavigationHandler에서 각 타입별 UI 처리 확인"
echo "2. menuConfig.js에서 메뉴 구조 확인"
echo "3. npm start로 봇 실행 및 테스트"
echo "4. 각 모듈별 추가 기능 구현"

echo -e "\n${MAGENTA}💡 팁:${NC}"
echo "- 모든 UI는 NavigationHandler가 처리합니다"
echo "- 모듈은 데이터만 반환합니다"
echo "- 서비스는 DB 작업을 담당합니다"

echo -e "\n${GREEN}✨ 모듈-서비스 연결 완료! ✨${NC}"