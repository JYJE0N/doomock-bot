# 🚨 보안 정리 가이드

## Git 히스토리에서 민감한 파일 제거

**.env.development 파일이 이전에 커밋되어 Git 히스토리에 민감한 정보가 남아있습니다.**
**모든 API 키와 시크릿을 새로 발급받고 아래 단계를 따라 히스토리를 정리하세요.**

### 🔥 즉시 조치 필요사항

#### 1. 모든 API 키 교체
- **Telegram Bot Token**: @BotFather에서 새 토큰 생성
- **Google Cloud API 키**: Google Cloud Console에서 새 키 생성
- **Weather API 키**: OpenWeatherMap에서 새 키 생성
- **MongoDB 연결 문자열**: Railway에서 새 데이터베이스 생성

#### 2. Git 히스토리 정리

**⚠️ 주의: 이 작업은 Git 히스토리를 변경합니다. 팀과 공유하는 리포지토리라면 모든 팀원과 협의 후 진행하세요.**

```bash
# 1. git-filter-repo 설치 (권장 방법)
pip install git-filter-repo

# 2. .env.development 파일을 히스토리에서 완전 제거
git filter-repo --path .env.development --invert-paths

# 또는 BFG Repo-Cleaner 사용 (대안)
# java -jar bfg.jar --delete-files .env.development
# git reflog expire --expire=now --all && git gc --prune=now --aggressive
```

#### 3. 강제 푸시 (주의 필요)
```bash
# 원격 리포지토리에 강제 푸시 (히스토리 변경으로 인해 필요)
git push origin --force --all
git push origin --force --tags
```

### 🛡️ 더 안전한 대안 (권장)

**새 리포지토리 생성하는 것이 가장 안전합니다:**

```bash
# 1. 새 리포지토리 생성
git clone --no-hardlinks --depth 1 <current-repo> <new-repo>
cd <new-repo>

# 2. 새 원격 리포지토리 설정
git remote set-url origin <new-repo-url>

# 3. 첫 커밋으로 푸시
git push -u origin main
```

### 🔧 Railway 환경변수 설정

**프로덕션 환경에서는 Railway의 Environment Variables를 사용하세요:**

1. Railway Dashboard 접속
2. 프로젝트 선택 > **Variables** 탭
3. 다음 환경변수들 추가:

```
NODE_ENV=production
BOT_TOKEN=<새로운_텔레그램_봇_토큰>
MONGO_URL=<새로운_몽고DB_연결_문자열>
GOOGLE_PROJECT_ID=<구글_프로젝트_ID>
GOOGLE_CLIENT_EMAIL=<구글_서비스_계정_이메일>
GOOGLE_PRIVATE_KEY=<새로운_구글_프라이빗_키>
TTS_API_KEY=<새로운_TTS_API_키>
WEATHER_API_KEY=<새로운_날씨_API_키>
AIR_KOREA_API_KEY=<새로운_대기질_API_키>
DEVELOPER_IDS=<텔레그램_사용자_ID>
BASE_URL=<레일웨이_앱_URL>
```

### ✅ 확인 체크리스트

- [ ] 모든 API 키를 새로 발급받았는가?
- [ ] Git 히스토리에서 .env.development가 제거되었는가?
- [ ] Railway에 새로운 환경변수가 설정되었는가?
- [ ] 로컬 .env.development 파일이 .gitignore에 포함되어 있는가?
- [ ] 새로운 봇 토큰으로 텔레그램 봇이 정상 작동하는가?

### 🚨 긴급 상황

만약 이미 악의적으로 사용된 흔적이 있다면:
1. 즉시 모든 API 키 비활성화
2. Google Cloud, Railway 등의 보안 로그 확인
3. 필요시 계정 보안 강화 (2FA 활성화)

---

**이 파일은 보안 정리 완료 후 삭제하는 것을 권장합니다.**