#!/bin/bash

echo "🔧 모듈들을 ServiceBuilder 패턴으로 업데이트합니다..."

# 모듈별 서비스 매핑
declare -A services=(
    ["TodoModule"]="todo"
    ["WeatherModule"]="weather" 
    ["ReminderModule"]="reminder"
    ["WorktimeModule"]="worktime"
    ["FortuneModule"]="fortune"
    ["TimerModule"]="timer"
    ["LeaveModule"]="leave"
    ["TTSModule"]="tts"
)

for module in "${!services[@]}"; do
    service=${services[$module]}
    file="src/modules/${module}.js"
    
    if [ -f "$file" ]; then
        echo "📝 업데이트 중: $module → $service"
        
        # 1. ServiceBuilder 줄 추가 (constructor에)
        sed -i "/this\.${service}Service = null;/i\\    this.serviceBuilder = options.serviceBuilder || null;" "$file"
        
        # 2. 서비스 생성 방식 변경 (onInitialize에)
        sed -i "s/this\.${service}Service = new.*Service(/this.${service}Service = await this.serviceBuilder.getOrCreate(\"$service\", {/" "$file"
        
        echo "✅ $module 업데이트 완료"
    else
        echo "⚠️  파일 없음: $file"
    fi
done

echo "🎉 모든 모듈 업데이트 완료!"
