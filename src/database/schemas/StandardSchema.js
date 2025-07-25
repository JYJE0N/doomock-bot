// src/database/schemas/StandardSchema.js
/**
 * 🗄️ 표준 데이터베이스 스키마 정의
 * - MongoDB 네이티브 드라이버 사용
 * - Railway 환경 최적화
 * - 표준 필드 체계
 */

/**
 * 📋 기본 문서 스키마 (모든 컬렉션 공통)
 */
const BaseDocumentSchema = {
  // 🔑 기본 식별자
  _id: "ObjectId", // MongoDB 기본 ID

  // 👤 사용자 정보
  userId: "Number", // 텔레그램 사용자 ID (필수)
  userName: "String", // 사용자명 (선택)

  // ⏰ 타임스탬프 (필수)
  createdAt: "Date", // 생성 시간
  updatedAt: "Date", // 수정 시간

  // 🏷️ 메타데이터
  version: "Number", // 문서 버전 (기본: 1)
  isActive: "Boolean", // 활성 상태 (기본: true)

  // 🌍 환경 정보
  environment: "String", // railway/development
  timezone: "String", // Asia/Seoul
};

/**
 * 📝 할일 스키마 (todos 컬렉션)
 */
const TodoSchema = {
  ...BaseDocumentSchema,

  // 📝 할일 내용
  text: "String", // 할일 텍스트 (필수)
  description: "String", // 상세 설명 (선택)

  // ✅ 완료 상태
  completed: "Boolean", // 완료 여부 (기본: false)
  completedAt: "Date", // 완료 시간 (null 가능)

  // 🎯 우선순위
  priority: "Number", // 1(낮음) ~ 5(높음), 기본: 3

  // 🏷️ 분류
  category: "String", // 카테고리 (업무, 개인, etc.)
  tags: ["String"], // 태그 배열

  // ⏰ 일정
  dueDate: "Date", // 마감일 (선택)
  reminderAt: "Date", // 알림 시간 (선택)

  // 📊 통계
  estimatedMinutes: "Number", // 예상 소요 시간 (분)
  actualMinutes: "Number", // 실제 소요 시간 (분)
};

/**
 * ⏰ 타이머 스키마 (timers 컬렉션)
 */
const TimerSchema = {
  ...BaseDocumentSchema,

  // ⏱️ 타이머 정보
  type: "String", // pomodoro/work/break/custom
  name: "String", // 타이머 이름

  // ⏰ 시간 설정
  duration: "Number", // 설정 시간 (분)
  remainingTime: "Number", // 남은 시간 (초)

  // 📊 상태
  status: "String", // running/paused/completed/stopped
  startedAt: "Date", // 시작 시간
  pausedAt: "Date", // 일시정지 시간 (null 가능)
  completedAt: "Date", // 완료 시간 (null 가능)

  // 🔄 뽀모도로 정보
  pomodoroRound: "Number", // 현재 라운드
  totalRounds: "Number", // 총 라운드

  // 📝 연결된 작업
  linkedTodoId: "ObjectId", // 연결된 할일 ID (선택)

  // 🔔 알림 설정
  notificationEnabled: "Boolean", // 알림 활성화 (기본: true)
  soundEnabled: "Boolean", // 사운드 활성화 (기본: true)
};

/**
 * 🏖️ 휴가 스키마 (leaves 컬렉션)
 */
const LeaveSchema = {
  ...BaseDocumentSchema,

  // 📅 휴가 기본 정보
  year: "Number", // 연도 (2025, 2026...)
  leaveType: "String", // ANNUAL/MONTHLY/SICK/HALF_DAY/QUARTER_DAY
  typeName: "String", // 한글명 (연차, 월차, etc.)

  // 📏 사용량
  requestedDays: "Number", // 신청 일수 (1, 0.5, 0.25)
  deductedDays: "Number", // 실제 차감 일수

  // 📅 날짜 정보
  startDate: "Date", // 시작일
  endDate: "Date", // 종료일
  useDate: "Date", // 사용일 (단일일 경우)

  // ⏰ 시간 정보
  timeType: "String", // 전일/오전/오후/시간지정
  timeRange: "String", // 09:00-18:00 형태

  // 📝 사유 및 메모
  reason: "String", // 휴가 사유
  memo: "String", // 메모

  // 📊 승인 상태
  status: "String", // pending/approved/rejected/used
  approvedAt: "Date", // 승인 시간
  approvedBy: "String", // 승인자

  // 🎯 연차 정보
  remainingLeaves: "Number", // 신청 후 잔여 연차
  totalLeaves: "Number", // 총 연차
};

/**
 * ⏰ 리마인더 스키마 (reminders 컬렉션)
 */
const ReminderSchema = {
  ...BaseDocumentSchema,

  // 📝 리마인더 내용
  message: "String", // 알림 메시지 (필수)

  // ⏰ 알림 시간
  reminderAt: "Date", // 알림 시간 (필수)
  type: "String", // minutes/time/recurring

  // 🔄 반복 설정
  isRecurring: "Boolean", // 반복 여부 (기본: false)
  recurringType: "String", // daily/weekly/monthly
  recurringDays: ["Number"], // 반복 요일 (0-6, 일-토)

  // 📊 상태
  status: "String", // pending/sent/cancelled
  sentAt: "Date", // 발송 시간

  // 🔔 알림 설정
  notificationEnabled: "Boolean", // 알림 활성화
  voiceEnabled: "Boolean", // 음성 알림 (TTS)

  // 📱 알림 결과
  deliveryStatus: "String", // success/failed/pending
  errorMessage: "String", // 오류 메시지 (선택)
};

/**
 * 🔮 운세 스키마 (fortunes 컬렉션)
 */
const FortuneSchema = {
  ...BaseDocumentSchema,

  // 📅 날짜
  date: "Date", // 운세 날짜 (YYYY-MM-DD)

  // 🔮 운세 타입
  fortuneType: "String", // general/work/love/money/health/party

  // 📜 운세 내용
  content: "String", // 운세 내용
  luckyItem: "String", // 행운의 아이템
  luckyColor: "String", // 행운의 색상
  luckyNumber: "Number", // 행운의 숫자

  // 🎯 점수
  score: "Number", // 운세 점수 (1-100)
  level: "String", // 대길/길/보통/흉/대흉

  // 🎰 로또 번호 (재물운 전용)
  lottoNumbers: ["Number"], // 로또 번호 6개

  // 🃏 타로카드 정보
  tarotCard: {
    name: "String", // 카드명
    meaning: "String", // 카드 의미
    advice: "String", // 조언
  },
};

/**
 * 🌤️ 날씨 캐시 스키마 (weather_cache 컬렉션)
 */
const WeatherCacheSchema = {
  ...BaseDocumentSchema,

  // 📍 위치 정보
  location: "String", // 도시명
  coordinates: {
    lat: "Number", // 위도
    lon: "Number", // 경도
  },

  // 🌤️ 날씨 데이터
  current: {
    temperature: "Number", // 현재 온도
    humidity: "Number", // 습도
    description: "String", // 날씨 설명
    icon: "String", // 아이콘 코드
    windSpeed: "Number", // 풍속
    pressure: "Number", // 기압
  },

  // 📅 예보 데이터
  forecast: [
    {
      date: "Date", // 예보 날짜
      minTemp: "Number", // 최저 온도
      maxTemp: "Number", // 최고 온도
      description: "String", // 날씨 설명
      icon: "String", // 아이콘
      precipitation: "Number", // 강수 확률
    },
  ],

  // ⏰ 캐시 정보
  cachedAt: "Date", // 캐시 시간
  expiresAt: "Date", // 만료 시간

  // 📊 API 정보
  source: "String", // API 소스 (openweather)
  requestCount: "Number", // 요청 횟수
};

/**
 * 🎤 TTS 기록 스키마 (tts_logs 컬렉션)
 */
const TTSLogSchema = {
  ...BaseDocumentSchema,

  // 📝 텍스트 정보
  text: "String", // 변환할 텍스트
  language: "String", // 언어 코드 (ko, en, etc.)

  // 🎵 음성 설정
  voice: "String", // 음성 타입
  speed: "Number", // 속도 (0.5-2.0)
  pitch: "Number", // 피치 (-20~20)

  // 📊 처리 결과
  status: "String", // success/failed/processing
  fileSize: "Number", // 파일 크기 (bytes)
  duration: "Number", // 음성 길이 (초)

  // 📂 파일 정보
  fileName: "String", // 생성된 파일명
  filePath: "String", // 파일 경로

  // ⏰ 처리 시간
  processingTime: "Number", // 처리 시간 (ms)

  // ❌ 오류 정보
  errorMessage: "String", // 오류 메시지
  retryCount: "Number", // 재시도 횟수
};

/**
 * 👤 사용자 설정 스키마 (user_settings 컬렉션)
 */
const UserSettingsSchema = {
  ...BaseDocumentSchema,

  // 🎛️ 일반 설정
  timezone: "String", // 시간대 (기본: Asia/Seoul)
  language: "String", // 언어 (기본: ko)

  // 🔔 알림 설정
  notifications: {
    enabled: "Boolean", // 알림 활성화
    sound: "Boolean", // 사운드 알림
    vibration: "Boolean", // 진동 알림
    quietHours: {
      enabled: "Boolean", // 조용한 시간 활성화
      start: "String", // 시작 시간 (22:00)
      end: "String", // 종료 시간 (08:00)
    },
  },

  // 📝 할일 설정
  todoSettings: {
    autoDelete: "Boolean", // 완료된 할일 자동 삭제
    defaultPriority: "Number", // 기본 우선순위
    showCompleted: "Boolean", // 완료된 할일 표시
  },

  // ⏰ 타이머 설정
  timerSettings: {
    workDuration: "Number", // 작업 시간 (분)
    shortBreak: "Number", // 짧은 휴식 (분)
    longBreak: "Number", // 긴 휴식 (분)
    autoStart: "Boolean", // 자동 시작
    soundAlert: "Boolean", // 사운드 알림
  },

  // 🎤 TTS 설정
  ttsSettings: {
    enabled: "Boolean", // TTS 활성화
    language: "String", // 기본 언어
    voice: "String", // 기본 음성
    speed: "Number", // 속도
    autoMode: "Boolean", // 자동 모드
  },
};

module.exports = {
  BaseDocumentSchema,
  TodoSchema,
  TimerSchema,
  LeaveSchema,
  ReminderSchema,
  FortuneSchema,
  WeatherCacheSchema,
  TTSLogSchema,
  UserSettingsSchema,
};
