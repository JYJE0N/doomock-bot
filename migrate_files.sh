#!/bin/bash
# 📦 Utils 파일 안전 이동 스크립트 v1.0
# 사용법: chmod +x migrate_files.sh && ./migrate_files.sh

echo "🚀 Utils 파일 이동 작업 시작..."

# 현재 위치 확인
if [ ! -d "src/utils" ]; then
    echo "❌ src/utils 폴더를 찾을 수 없습니다."
    echo "프로젝트 루트에서 실행해주세요."
    exit 1
fi

# 백업 생성
echo "💾 백업 생성 중..."
BACKUP_DIR="backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r src/utils "$BACKUP_DIR/"
echo "✅ 백업 완료: $BACKUP_DIR/utils"

# 필요한 디렉토리가 있는지 확인하고 없으면 건너뛰기
check_and_create_dir() {
    local dir="$1"
    if [ ! -d "$dir" ]; then
        echo "📁 디렉토리 생성: $dir"
        mkdir -p "$dir"
        return 0
    else
        echo "📁 디렉토리 이미 존재: $dir"
        return 1
    fi
}

echo ""
echo "📁 디렉토리 구조 확인 및 생성..."

# 디렉토리 생성 (이미 있으면 스킵)
check_and_create_dir "src/utils/core"
check_and_create_dir "src/utils/helper" 
check_and_create_dir "src/utils/validation"
check_and_create_dir "src/utils/formatters"
check_and_create_dir "src/utils/decorators"
check_and_create_dir "src/utils/schedulers"
check_and_create_dir "src/utils/deprecated"

echo ""
echo "📦 파일 이동 시작..."

# 이동할 파일들이 실제로 존재하는지 확인하고 이동
move_file_if_exists() {
    local source="$1"
    local dest="$2"
    local description="$3"
    
    if [ -f "$source" ]; then
        echo "📦 $description: $source → $dest"
        mv "$source" "$dest"
        echo "✅ 이동 완료: $dest"
    else
        echo "⚠️  파일 없음 (스킵): $source"
    fi
}

# 핵심 파일들을 core로 이동
echo ""
echo "🏛️  핵심 파일들을 core로 이동 중..."
move_file_if_exists "src/utils/Logger.js" "src/utils/core/" "Logger 이동"
move_file_if_exists "src/utils/UserHelper.js" "src/utils/core/" "UserHelper 이동"
move_file_if_exists "src/utils/SystemHelper.js" "src/utils/core/" "SystemHelper 이동"
move_file_if_exists "src/utils/StatusHelper.js" "src/utils/core/" "StatusHelper 이동"

# 헬퍼 파일들을 helper로 이동
echo ""
echo "🔧 헬퍼 파일들을 helper로 이동 중..."
move_file_if_exists "src/utils/TimeParseHelper.js" "src/utils/helper/" "TimeParseHelper 이동"
move_file_if_exists "src/utils/LocationHelper.js" "src/utils/helper/" "LocationHelper 이동"
move_file_if_exists "src/utils/TTSFileHelper.js" "src/utils/helper/" "TTSFileHelper 이동"

# 스케줄러 파일들 이동
echo ""
echo "⏰ 스케줄러 파일들을 schedulers로 이동 중..."
move_file_if_exists "src/utils/ReminderScheduler.js" "src/utils/schedulers/" "ReminderScheduler 이동"

# 기타 특수 파일들 처리
echo ""
echo "📂 특수 파일들 처리 중..."

# UnifiedMessageSystem.js는 나중에 수동으로 분할할 예정이므로 Message 폴더에서 유지
if [ -f "src/utils/Message/UnifiedMessageSystem.js" ]; then
    echo "📝 UnifiedMessageSystem.js는 Message/ 폴더에서 유지 (나중에 분할 예정)"
fi

# 이미 적절한 위치에 있는 파일들 확인
echo ""
echo "✅ 올바른 위치에 이미 있는 파일들:"
[ -d "src/utils/Message" ] && echo "📂 Message/ 폴더 존재"
[ -d "src/utils/core" ] && echo "📂 core/ 폴더 존재"
[ -d "src/utils/helper" ] && echo "📂 helper/ 폴더 존재"

echo ""
echo "🔍 이동 결과 확인..."

# 결과 확인
echo "📊 현재 utils 구조:"
if command -v tree >/dev/null 2>&1; then
    tree src/utils/ -I node_modules
else
    find src/utils -type f -name "*.js" | sort
fi

echo ""
echo "✨ 이동 작업 완료!"
echo ""
echo "🎯 다음 단계:"
echo "1. import 경로 업데이트 필요"
echo "2. UnifiedMessageSystem.js 분할 작업"
echo "3. 새로운 파일들 생성 (decorators, formatters, validation)"
echo ""
echo "💾 백업 위치: $BACKUP_DIR"
echo "문제가 생기면 백업에서 복원하세요: cp -r $BACKUP_DIR/utils src/"

# import 경로 업데이트 안내
echo ""
echo "🔧 Import 경로 업데이트가 필요한 파일들:"
echo ""

# Logger 참조하는 파일들 찾기
echo "Logger.js 참조 파일들:"
grep -r "require.*Logger" src/ --include="*.js" | head -5
echo ""

echo "UserHelper.js 참조 파일들:"
grep -r "require.*UserHelper" src/ --include="*.js" | head -5
echo ""

echo "🚨 중요: 모든 import 경로를 새 위치에 맞게 업데이트해야 합니다!"
echo "예시: require('./Logger') → require('./core/Logger')"