# 🚄 Railway 환경변수 설정 가이드

## Railway Dashboard에서 환경변수 설정하기

### 📍 단계별 설정 방법

#### 1. Railway Dashboard 접속
1. [Railway.app](https://railway.app) 접속
2. GitHub/Google 계정으로 로그인
3. **doomock-bot** 프로젝트 선택

#### 2. Environment Variables 설정
1. 프로젝트 대시보드에서 **Variables** 탭 클릭
2. **+ Add Variable** 버튼 클릭
3. 아래 환경변수들을 하나씩 추가:

### 🔑 필수 환경변수 목록

```bash
# 기본 설정
NODE_ENV=production
FORCE_LOGGER=winston
LOG_LEVEL=info

# API 키들 (새로 발급받은 키 사용)
BOT_TOKEN=새로운_텔레그램_봇_토큰
MONGO_URL=새로운_몽고DB_연결_문자열
WEATHER_API_KEY=새로운_날씨_API_키
AIR_KOREA_API_KEY=새로운_대기질_API_키

# Google Cloud 설정
GOOGLE_PROJECT_ID=doomock-bot-tts
GOOGLE_CLIENT_EMAIL=doomockbot-tts@doomock-bot-tts.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=새로운_구글_프라이빗_키_전체_내용
TTS_API_KEY=새로운_구글_TTS_API_키

# 앱 설정
BASE_URL=https://doomock-bot-production.up.railway.app
DEVELOPER_IDS=6930584944

# 기능 설정
TODO_MAX_TEXT_LENGTH=500
TODO_PAGE_SIZE=10
TODO_CACHE_ENABLED=true
FORTUNE_DEV_MODE=false
FORTUNE_UNLIMITED=false
PRIVACY_MODE=true
LOG_USER_IDS=false
LOG_RETENTION_DAYS=30

# TTS 설정
TTS_CACHE_DIR=./cache/tts
TTS_DEFAULT_LANGUAGE=ko-KR
TTS_MAX_TEXT_LENGTH=5000
TTS_VOICE_NAME=ko-KR-Wavenet-A

# 날씨 설정
DEFAULT_WEATHER_CITY=서울
WEATHER_ENABLE_DUST=true
WEATHER_ENABLE_FORECAST=true

# 타이머 설정 (프로덕션용)
TIMER_FOCUS_DURATION=25
TIMER_SHORT_BREAK=5
TIMER_LONG_BREAK=15
```

### 🔐 Google Private Key 설정 주의사항

**GOOGLE_PRIVATE_KEY 설정 시:**
1. 전체 키를 복사 (-----BEGIN PRIVATE KEY----- 부터 -----END PRIVATE KEY----- 까지)
2. 줄바꿈(\n)을 실제 줄바꿈으로 유지
3. Railway에서는 텍스트 영역에 그대로 붙여넣기

**예시:**
```
-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDZhXxcQ6gd4W8c
(여러 줄의 키 내용)
-----END PRIVATE KEY-----
```

### 🚀 배포 및 확인

#### 1. 환경변수 적용
- 환경변수 저장 후 Railway가 자동으로 재배포합니다
- **Deployments** 탭에서 배포 상태 확인

#### 2. 로그 확인
```bash
# Railway CLI 설치 (선택사항)
npm install -g @railway/cli

# 로그 실시간 확인
railway logs --follow
```

#### 3. Health Check
- 배포 완료 후 `https://your-app.railway.app/health` 접속
- 봇이 정상 응답하는지 확인

### 🛠️ 트러블슈팅

#### 일반적인 문제들

**1. Bot Token 오류**
```
Error: 401 Unauthorized
```
- 새로운 봇 토큰이 올바른지 확인
- @BotFather에서 봇이 활성화되어 있는지 확인

**2. MongoDB 연결 오류**
```
MongoNetworkError: failed to connect
```
- MongoDB URL이 올바른지 확인
- Railway의 MongoDB 서비스가 실행 중인지 확인

**3. Google Cloud 인증 오류**
```
Error: The incoming JSON object does not contain a client_email field
```
- GOOGLE_PRIVATE_KEY의 줄바꿈이 올바른지 확인
- 서비스 계정 키가 유효한지 확인

**4. 메모리 부족**
```
JavaScript heap out of memory
```
- Railway 플랜 업그레이드 또는
- `--max-old-space-size=450` 플래그 확인

### 📋 배포 체크리스트

배포 후 다음 기능들이 정상 작동하는지 확인:

- [ ] 텔레그램 봇 응답
- [ ] 할일 관리 기능
- [ ] 타이머 기능  
- [ ] 날씨 정보
- [ ] TTS 음성 변환
- [ ] 근무시간 관리
- [ ] 휴가 관리
- [ ] 운세 기능

### 🔍 모니터링

**Railway Dashboard에서 확인할 수 있는 정보:**
- CPU/Memory 사용량
- 응답 시간
- 에러 로그
- 배포 히스토리

**알림 설정:**
- Railway Notifications에서 에러 알림 설정
- 메모리/CPU 임계치 알림 설정

---

**설정 완료 후 이 파일은 삭제하거나 .gitignore에 추가하세요.**