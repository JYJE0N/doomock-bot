#!/bin/bash
# 🔧 Import 경로 자동 업데이트 스크립트 v1.0
# 파일 이동 후 모든 import 경로를 자동으로 업데이트

echo "🔧 Import 경로 업데이트 작업 시작..."

# 백업 생성
echo "💾 Import 업데이트 전 백업 생성..."
BACKUP_DIR="backup_imports_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r src "$BACKUP_DIR/"
echo "✅ 백업 완료: $BACKUP_DIR/src"

# 안전한 경로 교체 함수
safe_replace() {
    local pattern="$1"
    local replacement="$2"
    local description="$3"
    
    echo "🔄 $description"
    echo "   패턴: $pattern"
    echo "   교체: $replacement"
    
    # macOS와 Linux 호환성을 위해 다른 방식 사용
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        find src -name "*.js" -type f -exec sed -i '' "s|$pattern|$replacement|g" {} +
    else
        # Linux
        find src -name "*.js" -type f -exec sed -i "s|$pattern|$replacement|g" {} +
    fi
    
    echo "✅ 교체 완료"
    echo ""
}

echo ""
echo "📝 Core 파일들의 import 경로 업데이트..."

# Logger.js 경로 업데이트
safe_replace 'require("../utils/Logger")' 'require("../utils/core/Logger")' "Logger 경로 업데이트 (상대경로 ..)"
safe_replace "require('../utils/Logger')" "require('../utils/core/Logger')" "Logger 경로 업데이트 (상대경로 .. 작은따옴표)"
safe_replace 'require("./Logger")' 'require("./core/Logger")' "Logger 경로 업데이트 (같은 레벨)"
safe_replace "require('./Logger')" "require('./core/Logger')" "Logger 경로 업데이트 (같은 레벨 작은따옴표)"

# UserHelper.js 경로 업데이트
safe_replace 'require("../utils/UserHelper")' 'require("../utils/core/UserHelper")' "UserHelper 경로 업데이트"
safe_replace "require('../utils/UserHelper')" "require('../utils/core/UserHelper')" "UserHelper 경로 업데이트 (작은따옴표)"

# SystemHelper.js 경로 업데이트
safe_replace 'require("../utils/SystemHelper")' 'require("../utils/core/SystemHelper")' "SystemHelper 경로 업데이트"
safe_replace "require('../utils/SystemHelper')" "require('../utils/core/SystemHelper')" "SystemHelper 경로 업데이트 (작은따옴표)"

# StatusHelper.js 경로 업데이트
safe_replace 'require("../utils/StatusHelper")' 'require("../utils/core/StatusHelper")' "StatusHelper 경로 업데이트"
safe_replace "require('../utils/StatusHelper')" "require('../utils/core/StatusHelper')" "StatusHelper 경로 업데이트 (작은따옴표)"

echo "🔧 Helper 파일들의 import 경로 업데이트..."

# TimeParseHelper.js 경로 업데이트
safe_replace 'require("../utils/TimeParseHelper")' 'require("../utils/helper/TimeParseHelper")' "TimeParseHelper 경로 업데이트"
safe_replace "require('../utils/TimeParseHelper')" "require('../utils/helper/TimeParseHelper')" "TimeParseHelper 경로 업데이트 (작은따옴표)"

# LocationHelper.js 경로 업데이트
safe_replace 'require("../utils/LocationHelper")' 'require("../utils/helper/LocationHelper")' "LocationHelper 경로 업데이트"
safe_replace "require('../utils/LocationHelper')" "require('../utils/helper/LocationHelper')" "LocationHelper 경로 업데이트 (작은따옴표)"

# TTSFileHelper.js 경로 업데이트
safe_replace 'require("../utils/TTSFileHelper")' 'require("../utils/helper/TTSFileHelper")' "TTSFileHelper 경로 업데이트"
safe_replace "require('../utils/TTSFileHelper')" "require('../utils/helper/TTSFileHelper')" "TTSFileHelper 경로 업데이트 (작은따옴표)"

echo "⏰ Scheduler 파일들의 import 경로 업데이트..."

# ReminderScheduler.js 경로 업데이트
safe_replace 'require("../utils/ReminderScheduler")' 'require("../utils/schedulers/ReminderScheduler")' "ReminderScheduler 경로 업데이트"
safe_replace "require('../utils/ReminderScheduler')" "require('../utils/schedulers/ReminderScheduler')" "ReminderScheduler 경로 업데이트 (작은따옴표)"

echo "🔄 Core 파일들 내부의 상호 참조 업데이트..."

# core 폴더 내부에서의 상호 참조 (같은 폴더 내)
echo "📁 core 폴더 내부 파일들 처리 중..."
if [ -d "src/utils/core" ]; then
    cd src/utils/core
    
    # 같은 폴더의 파일들을 참조할 때 경로 수정
    for file in *.js; do
        if [ -f "$file" ]; then
            echo "🔧 $file 내부 참조 업데이트 중..."
            
            # macOS와 Linux 호환성
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' 's|require("../Logger")|require("./Logger")|g' "$file"
                sed -i '' "s|require('../Logger')|require('./Logger')|g" "$file"
                sed -i '' 's|require("../UserHelper")|require("./UserHelper")|g' "$file"
                sed -i '' "s|require('../UserHelper')|require('./UserHelper')|g" "$file"
                sed -i '' 's|require("../SystemHelper")|require("./SystemHelper")|g' "$file"
                sed -i '' "s|require('../SystemHelper')|require('./SystemHelper')|g" "$file"
                sed -i '' 's|require("../StatusHelper")|require("./StatusHelper")|g' "$file"
                sed -i '' "s|require('../StatusHelper')|require('./StatusHelper')|g" "$file"
            else
                sed -i 's|require("../Logger")|require("./Logger")|g' "$file"
                sed -i "s|require('../Logger')|require('./Logger')|g" "$file"
                sed -i 's|require("../UserHelper")|require("./UserHelper")|g' "$file"
                sed -i "s|require('../UserHelper')|require('./UserHelper')|g" "$file"
                sed -i 's|require("../SystemHelper")|require("./SystemHelper")|g' "$file"
                sed -i "s|require('../SystemHelper')|require('./SystemHelper')|g" "$file"
                sed -i 's|require("../StatusHelper")|require("./StatusHelper")|g' "$file"
                sed -i "s|require('../StatusHelper')|require('./StatusHelper')|g" "$file"
            fi
        fi
    done
    
    cd ../../..
fi

echo ""
echo "🔍 업데이트 결과 확인..."

# 업데이트 후 검증
echo "✅ 업데이트된 import 구문들:"
echo ""
echo "📋 Logger 참조:"
grep -r "require.*core/Logger" src/ --include="*.js" | head -3
echo ""
echo "📋 UserHelper 참조:"
grep -r "require.*core/UserHelper" src/ --include="*.js" | head -3
echo ""
echo "📋 Helper 폴더 참조:"
grep -r "require.*helper/" src/ --include="*.js" | head -3

echo ""
echo "🚨 수동 확인이 필요한 파일들:"
echo ""

# 아직 업데이트되지 않은 구식 경로들 찾기
echo "❓ 아직 구식 경로를 사용하는 파일들:"
grep -r "require.*utils/[A-Z]" src/ --include="*.js" | grep -v "core/" | grep -v "helper/" | grep -v "schedulers/" | head -5

echo ""
echo "✨ Import 경로 업데이트 완료!"
echo ""
echo "🎯 다음 단계:"
echo "1. npm test 또는 노드 실행해서 오류 확인"
echo "2. 오류가 있다면 수동으로 추가 수정"
echo "3. UnifiedMessageSystem.js 분할 작업 진행"
echo ""
echo "💾 백업 위치: $BACKUP_DIR"
echo "문제가 생기면 복원: cp -r $BACKUP_DIR/src ."