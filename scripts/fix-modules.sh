#!/bin/bash
# fix-modules.sh - 모듈 정리 및 올바른 생성

# 색상
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🧹 모듈 정리 및 재생성${NC}"
echo "======================================"

# 현재 모듈 백업
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="backup_fix_${TIMESTAMP}"
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}📁 현재 파일 백업 중...${NC}"
cp -r src/modules "$BACKUP_DIR/"
cp -r src/services "$BACKUP_DIR/" 2>/dev/null || true

# 이상한 파일 제거
echo -e "\n${RED}🗑️  잘못된 파일 제거 중...${NC}"
rm -f src/modules/0Module.js
echo -e "  - 0Module.js 제거됨"

# 기존 모듈 중 유지할 것들
echo -e "\n${GREEN}✅ 유지할 모듈:${NC}"
echo "  - SystemModule.js (시스템 핵심)"
echo "  - TodoModule.js (이미 표준화됨)"

# 필요한 모듈 목록
echo -e "\n${BLUE}📦 생성할 모듈:${NC}"
echo "  - ReminderModule.js (리마인더)"
echo "  - WorktimeModule.js (퇴근계산기)"  
echo "  - LeaveModule.js (연차계산기)"
echo "  - TimerModule.js (집중타이머)"
echo "  - WeatherModule.js (날씨)"
echo "  - FortuneModule.js (운세)"
echo "  - TTSModule.js (TTS)"

# 사용자 확인
echo -e "\n${YELLOW}⚠️  주의: 기존 모듈이 덮어씌워집니다.${NC}"
read -p "계속하시겠습니까? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "취소되었습니다."
    exit 1
fi

# 모듈 정보 (InsightModule 제외)
declare -A MODULES=(
  ["Reminder"]="⏰:리마인더:reminder"
  ["Worktime"]="🏢:퇴근계산기:worktime"
  ["Leave"]="🏖️:연차계산기:leave"
  ["Timer"]="⏱️:집중타이머:timer"
  ["Weather"]="🌤️:날씨:weather"
  ["Fortune"]="🔮:운세:fortune"
  ["TTS"]="🔊:TTS:tts"
)

# 각 모듈 생성 (SystemModule과 TodoModule은 제외)
for MODULE in "${!MODULES[@]}"; do
  IFS=':' read -r ICON DESC KEY <<< "${MODULES[$MODULE]}"
  
  # 이미 표준화된 모듈은 건너뛰기
  if [[ "$MODULE" == "Todo" ]] || [[ "$MODULE" == "System" ]]; then
    echo -e "${GREEN}✓ ${MODULE}Module.js는 이미 표준화됨${NC}"
    continue
  fi
  
  echo -e "\n${YELLOW}${ICON} ${MODULE}Module 생성 중...${NC}"
  
  # 기존 파일이 표준화되지 않았으면 새로 생성
  if [[ -f "src/modules/${MODULE}Module.js" ]]; then
    # 파일이 이미 있으면 표준화 여부 확인
    if grep -q "BaseModule" "src/modules/${MODULE}Module.js" && grep -q "${MODULE}Service" "src/modules/${MODULE}Module.js"; then
      echo -e "${GREEN}✓ ${MODULE}Module.js는 이미 서비스와 연결됨${NC}"
      continue
    fi
  fi
  
  # 모듈 파일 생성 (서비스 연결 포함)
  cat > "src/modules/${MODULE}Module.js" << EOF
// src/modules/${MODULE}Module.js - ${DESC}
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserName, getUserId } = require("../utils/UserHelper");

/**
 * ${ICON} ${MODULE}Module - ${DESC}
 * 
 * 심플한 구조:
 * - 데이터만 반환
 * - UI는 NavigationHandler가 처리
 * - 서비스와 연결됨
 */
class ${MODULE}Module extends BaseModule {
  constructor(bot, options = {}) {
    super("${MODULE}Module", {
      bot,
      moduleManager: options.moduleManager,
      config: options.config
    });

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
      const ${MODULE}Service = require("../services/${MODULE}Service");
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
      // TODO: 필요한 액션 추가
    });
    
    logger.module('${MODULE}Module', \`✅ \${this.actionMap.size}개 액션 등록\`);
  }

  /**
   * 📊 메뉴 데이터 반환
   */
  async getMenuData(bot, callbackQuery, params, moduleManager) {
    const userName = getUserName(callbackQuery);
    const userId = getUserId(callbackQuery);
    
    // TODO: 실제 데이터는 서비스에서
    const mockData = {
      total: 0,
      active: 0,
      completed: 0
    };
    
    return {
      type: 'menu',
      module: '${KEY}',
      userName: userName,
      stats: mockData
    };
  }

  /**
   * 💬 메시지 처리
   */
  async onHandleMessage(bot, msg) {
    // TODO: 필요시 구현
    return false;
  }
}

module.exports = ${MODULE}Module;
EOF

  echo -e "${GREEN}✅ ${MODULE}Module.js 생성 완료${NC}"
  
  # 서비스도 없으면 생성
  if [[ ! -f "src/services/${MODULE}Service.js" ]]; then
    echo -e "${YELLOW}🔧 ${MODULE}Service 생성 중...${NC}"
    
    cat > "src/services/${MODULE}Service.js" << EOF
// src/services/${MODULE}Service.js - ${DESC} 서비스
const BaseService = require("./BaseService");
const logger = require("../utils/Logger");

/**
 * 🔧 ${MODULE}Service - ${DESC} 데이터 서비스
 */
class ${MODULE}Service extends BaseService {
  constructor() {
    super("${KEY}s");
    
    logger.module('${MODULE}Service', '🔧 서비스 생성됨');
  }

  async initialize() {
    try {
      logger.module('${MODULE}Service', '📦 초기화 시작...');
      
      // TODO: DB 연결
      
      logger.success('✅ ${MODULE}Service 초기화 완료');
    } catch (error) {
      logger.error('❌ ${MODULE}Service 초기화 실패', error);
      this.memoryMode = true;
    }
  }

  // TODO: 기본 CRUD 구현

  async getUserStats(userId) {
    return {
      success: true,
      data: {
        total: 0,
        active: 0,
        completed: 0
      }
    };
  }

  getStatus() {
    return {
      name: '${MODULE}Service',
      mode: this.memoryMode ? 'memory' : 'database'
    };
  }
}

module.exports = ${MODULE}Service;
EOF

    echo -e "${GREEN}✅ ${MODULE}Service.js 생성 완료${NC}"
  fi
done

# InsightModule 처리
if [[ -f "src/modules/InsightModule.js" ]]; then
  echo -e "\n${YELLOW}🤔 InsightModule이 발견되었습니다.${NC}"
  echo "이 모듈은 계획에 없던 모듈입니다."
  read -p "삭제하시겠습니까? (y/N): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -f src/modules/InsightModule.js
    rm -f src/services/InsightService.js
    echo -e "${GREEN}✅ InsightModule 삭제됨${NC}"
  fi
fi

# 최종 확인
echo -e "\n${BLUE}📋 최종 모듈 목록:${NC}"
ls -la src/modules/ | grep -E "Module\.js$" | awk '{print "  - " $9}'

echo -e "\n${GREEN}✅ 모듈 정리 완료!${NC}"
echo -e "\n${YELLOW}📌 다음 단계:${NC}"
echo "1. moduleRegistry.json 업데이트"
echo "2. NavigationHandler에서 각 모듈 UI 처리 확인"
echo "3. menuConfig.js에서 메뉴 구조 확인"
echo "4. npm start로 테스트"

# moduleRegistry.json 생성 제안
echo -e "\n${CYAN}💡 moduleRegistry.json 업데이트가 필요합니다.${NC}"
echo "다음 모듈들이 등록되어야 합니다:"
echo "  - system, todo, reminder, worktime, leave"
echo "  - timer, weather, fortune, tts"