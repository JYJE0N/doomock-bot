#!/bin/bash
# create-all-module-shells.sh - 모든 모듈/서비스 껍데기 생성

# 모듈 정보 배열
declare -A MODULES
MODULES[Todo]="📝:할일 관리"
MODULES[Reminder]="⏰:리마인더"
MODULES[Worktime]="🏢:퇴근계산기"
MODULES[Leave]="🏖️:연차계산기"
MODULES[Timer]="⏱️:집중타이머"
MODULES[Weather]="🌤️:날씨"
MODULES[Fortune]="🔮:운세"
MODULES[TTS]="🔊:TTS"

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 모듈 껍데기 생성 시작${NC}"
echo "================================"

# 각 모듈 생성
for MODULE in "${!MODULES[@]}"; do
  IFS=':' read -r ICON DESC <<< "${MODULES[$MODULE]}"
  
  echo -e "\n${YELLOW}${ICON} ${MODULE}Module 생성 중...${NC}"
  
  # 모듈 파일 생성
  cat > "src/modules/${MODULE}Module.js" << EOF
// src/modules/${MODULE}Module.js - ${DESC}
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const formatter = require("../utils/MessageFormatter");
const { getUserName, getUserId } = require("../utils/UserHelper");

/**
 * ${ICON} ${MODULE}Module - ${DESC}
 * 
 * 🎯 UI 먼저 구현 → 로직은 나중에
 */
class ${MODULE}Module extends BaseModule {
  constructor(bot, options = {}) {
    super("${MODULE}Module", {
      bot,
      moduleManager: options.moduleManager,
      config: options.config
    });

    this.config = {
      enabled: true,
      version: "1.0.0",
      icon: "${ICON}",
      ...options.config
    };

    this.${MODULE,,}Service = null;

    logger.module('${MODULE}Module', '🚀 모듈 생성됨', {
      version: this.config.version
    });
  }

  async onInitialize() {
    try {
      logger.module('${MODULE}Module', '📦 초기화 시작...');
      
      // TODO: 서비스 초기화
      // const ${MODULE}Service = require('../services/${MODULE}Service');
      // this.${MODULE,,}Service = new ${MODULE}Service();
      // await this.${MODULE,,}Service.initialize();
      
      logger.success('✅ ${MODULE}Module 초기화 완료');
    } catch (error) {
      logger.error('❌ ${MODULE}Module 초기화 실패', error);
      throw error;
    }
  }

  setupActions() {
    this.registerActions({
      menu: this.showMenu,
      // TODO: 추가 액션들
    });
    
    logger.module('${MODULE}Module', \`✅ \${this.actionMap.size}개 액션 등록\`);
  }

  async showMenu(bot, callbackQuery, params, moduleManager) {
    logger.navigation('user', '${MODULE,,}:menu');
    
    const userName = getUserName(callbackQuery);
    
    const menuText = [
      formatter.title('${DESC}', '${ICON}'),
      '',
      \`안녕하세요, \${formatter.highlight(userName)}님!\`,
      '',
      formatter.section('메뉴', '📋'),
      '${DESC} 기능입니다.',
      '',
      '🚧 준비 중입니다.',
      '',
      formatter.decorate('곧 만나요!', '✨', '✨')
    ].join('\\n');
    
    return {
      success: true,
      action: 'render_module_menu',
      data: {
        text: menuText,
        module: '${MODULE,,}'
      }
    };
  }
}

module.exports = ${MODULE}Module;
EOF

  echo -e "${GREEN}✅ ${MODULE}Module.js 생성 완료${NC}"

  # 서비스 파일 생성
  cat > "src/services/${MODULE}Service.js" << EOF
// src/services/${MODULE}Service.js - ${DESC} 서비스
const BaseService = require("./BaseService");
const logger = require("../utils/Logger");

/**
 * 🔧 ${MODULE}Service - ${DESC} 데이터 서비스
 */
class ${MODULE}Service extends BaseService {
  constructor() {
    super("${MODULE,,}s");
    
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

  // TODO: CRUD 메서드들 구현

  getStatus() {
    return {
      name: '${MODULE}Service',
      mode: this.memoryMode ? 'memory' : 'database',
      ready: false
    };
  }
}

module.exports = ${MODULE}Service;
EOF

  echo -e "${GREEN}✅ ${MODULE}Service.js 생성 완료${NC}"
done

echo -e "\n${BLUE}================================${NC}"
echo -e "${GREEN}✅ 모든 모듈 생성 완료!${NC}"
echo -e "\n📋 생성된 모듈:"
for MODULE in "${!MODULES[@]}"; do
  IFS=':' read -r ICON DESC <<< "${MODULES[$MODULE]}"
  echo -e "  ${ICON} ${MODULE}Module / ${MODULE}Service"
done

echo -e "\n💡 다음 단계:"
echo "  1. NavigationHandler에 각 모듈 UI 추가"
echo "  2. ModuleRegistry 업데이트"
echo "  3. 메뉴 동작 테스트"
echo "  4. 서비스 로직 구현"