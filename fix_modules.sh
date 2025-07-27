#!/bin/bash

echo "🔧 모듈들을 ServiceBuilder 패턴으로 업데이트합니다..."

# 실제 파일 확인
echo "📁 발견된 모듈 파일들:"
ls src/modules/*.js | grep -v ".bak"

echo ""
echo "🎯 각 모듈별 업데이트 시작..."

# TodoModule 수정
echo "📝 TodoModule 업데이트 중..."
if [ -f "src/modules/TodoModule.js" ]; then
    # 1. serviceBuilder 줄 추가 (this.todoService = null; 위에)
    sed -i.bak '/this\.todoService = null;/i\
    // ServiceBuilder 인스턴스 (의존성 주입)\
    this.serviceBuilder = options.serviceBuilder || null;' src/modules/TodoModule.js
    
    # 2. 서비스 생성 방식 변경
    sed -i '/new TodoService/c\
      // ServiceBuilder를 통한 서비스 요청\
      if (this.serviceBuilder) {\
        this.todoService = await this.serviceBuilder.getOrCreate("todo", {\
          config: this.config,\
        });\
      } else {\
        // 폴백: 직접 생성\
        const TodoService = require("../services/TodoService");\
        this.todoService = new TodoService({\
          config: this.config,\
        });\
        await this.todoService.initialize();\
      }' src/modules/TodoModule.js
    
    echo "✅ TodoModule 업데이트 완료"
else
    echo "❌ TodoModule.js 파일 없음"
fi

# WeatherModule 수정
echo "📝 WeatherModule 업데이트 중..."
if [ -f "src/modules/WeatherModule.js" ]; then
    sed -i.bak '/this\.weatherService = null;/i\
    this.serviceBuilder = options.serviceBuilder || null;' src/modules/WeatherModule.js
    
    sed -i '/new WeatherService/c\
      if (this.serviceBuilder) {\
        this.weatherService = await this.serviceBuilder.getOrCreate("weather", {\
          config: this.config,\
        });\
      } else {\
        const WeatherService = require("../services/WeatherService");\
        this.weatherService = new WeatherService({\
          config: this.config,\
        });\
        await this.weatherService.initialize();\
      }' src/modules/WeatherModule.js
    
    echo "✅ WeatherModule 업데이트 완료"
fi

echo ""
echo "🎉 주요 모듈 업데이트 완료!"
echo "📋 변경 확인:"
grep -n "serviceBuilder\|getOrCreate" src/modules/TodoModule.js src/modules/WeatherModule.js
