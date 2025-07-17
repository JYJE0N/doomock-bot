// src/config/AppConfig.js - 앱 설정
require('dotenv').config();

class AppConfig {
    constructor() {
        this.loadConfiguration();
        this.validateConfiguration();
    }

    loadConfiguration() {
        // 🤖 봇 설정
        this.BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
        this.BOT_USERNAME = process.env.BOT_USERNAME || 'doomock_bot';

        // 🌍 환경 설정
        this.NODE_ENV = process.env.NODE_ENV || 'development';
        this.PORT = parseInt(process.env.PORT) || 3000;
        this.VERSION = process.env.npm_package_version || '1.0.0';

        // 💾 데이터베이스 설정
        this.MONGO_URL = this.getMongoUrl();
        this.DB_NAME = process.env.DB_NAME || 'doomock_bot';

        // 🌤️ 외부 API 설정
        this.WEATHER_API_KEY = process.env.WEATHER_API_KEY || process.env.OPENWEATHER_API_KEY;
        this.AIR_KOREA_API_KEY = process.env.AIR_KOREA_API_KEY;

        // 🔐 보안 설정
        this.ADMIN_USER_IDS = this.parseAdminUsers();
        this.ALLOWED_USER_IDS = this.parseAllowedUsers();

        // ⚡ 성능 설정
        this.RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000; // 1분
        this.RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 30;
        this.CACHE_TTL_MS = parseInt(process.env.CACHE_TTL_MS) || 600000; // 10분

        // 📁 파일 시스템 설정
        this.TEMP_DIR = process.env.TEMP_DIR || './temp';
        this.LOGS_DIR = process.env.LOGS_DIR || './logs';

        // 🔧 기능 토글
        this.FEATURES = {
            TODO_MODULE: this.parseBoolean(process.env.ENABLE_TODO_MODULE, true),
            LEAVE_MODULE: this.parseBoolean(process.env.ENABLE_LEAVE_MODULE, true),
            WEATHER_MODULE: this.parseBoolean(process.env.ENABLE_WEATHER_MODULE, true),
            FORTUNE_MODULE: this.parseBoolean(process.env.ENABLE_FORTUNE_MODULE, true),
            TIMER_MODULE: this.parseBoolean(process.env.ENABLE_TIMER_MODULE, true),
            INSIGHT_MODULE: this.parseBoolean(process.env.ENABLE_INSIGHT_MODULE, true),
            UTILS_MODULE: this.parseBoolean(process.env.ENABLE_UTILS_MODULE, true),
            REMINDER_MODULE: this.parseBoolean(process.env.ENABLE_REMINDER_MODULE, true),
            WORKTIME_MODULE: this.parseBoolean(process.env.ENABLE_WORKTIME_MODULE, true),
            TTS_FEATURE: this.parseBoolean(process.env.ENABLE_TTS_FEATURE, true),
            VOICE_FEATURE: this.parseBoolean(process.env.ENABLE_VOICE_FEATURE, true)
        };

        // 🌐 Railway 특화 설정
        this.RAILWAY = {
            DEPLOYMENT_ID: process.env.RAILWAY_DEPLOYMENT_ID,
            PROJECT_ID: process.env.RAILWAY_PROJECT_ID,
            SERVICE_ID: process.env.RAILWAY_SERVICE_ID,
            ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT,
            PUBLIC_DOMAIN: process.env.RAILWAY_PUBLIC_DOMAIN
        };

        // 📊 로깅 설정
        this.LOGGING = {
            LEVEL: process.env.LOG_LEVEL || 'info',
            CONSOLE_ENABLED: this.parseBoolean(process.env.CONSOLE_LOGGING, true),
            FILE_ENABLED: this.parseBoolean(process.env.FILE_LOGGING, false),
            MAX_LOG_FILES: parseInt(process.env.MAX_LOG_FILES) || 5,
            MAX_LOG_SIZE: process.env.MAX_LOG_SIZE || '10MB'
        };

        // 🏡 화성/동탄 특화 설정
        this.DONGTAN = {
            DEFAULT_CITY: '화성',
            SPECIAL_LOCATIONS: ['동탄', '화성', '수원', '성남'],
            TIME_ZONE: 'Asia/Seoul',
            WORK_START: '08:30',
            WORK_END: '17:30',
            LUNCH_START: '11:30',
            LUNCH_END: '13:00'
        };
    }

    // MongoDB URL 우선순위에 따라 결정
    getMongoUrl() {
        const candidates = [
            process.env.MONGO_URL,
            process.env.MONGO_PUBLIC_URL,
            process.env.MONGODB_URI,
            process.env.MONGO_URI
        ];

        // 환경 변수에서 직접 URL 찾기
        for (const url of candidates) {
            if (url && (url.startsWith('mongodb://') || url.startsWith('mongodb+srv://'))) {
                return url;
            }
        }

        // 개별 컴포넌트로 URL 구성
        const mongoUser = process.env.MONGOUSER || process.env.MONGO_USER;
        const mongoPassword = process.env.MONGOPASSWORD || process.env.MONGO_PASSWORD;
        const mongoHost = process.env.MONGOHOST || process.env.MONGO_HOST || 'localhost';
        const mongoPort = process.env.MONGOPORT || process.env.MONGO_PORT || '27017';

        if (mongoUser && mongoPassword && mongoHost) {
            return `mongodb://${mongoUser}:${mongoPassword}@${mongoHost}:${mongoPort}`;
        }

        return null; // MongoDB 설정 없음
    }

    // 관리자 사용자 파싱
    parseAdminUsers() {
        const adminIds = process.env.ADMIN_USER_IDS || process.env.ADMIN_IDS || '';
        if (!adminIds) return [];
        
        return adminIds.split(',')
            .map(id => id.trim())
            .filter(id => id && !isNaN(id))
            .map(id => parseInt(id));
    }

    // 허용된 사용자 파싱
    parseAllowedUsers() {
        const allowedIds = process.env.ALLOWED_USER_IDS || '';
        if (!allowedIds) return []; // 빈 배열이면 모든 사용자 허용
        
        return allowedIds.split(',')
            .map(id => id.trim())
            .filter(id => id && !isNaN(id))
            .map(id => parseInt(id));
    }

    // 불린 값 파싱
    parseBoolean(value, defaultValue = false) {
        if (value === undefined || value === null) return defaultValue;
        if (typeof value === 'boolean') return value;
        
        const str = value.toString().toLowerCase();
        return ['true', '1', 'yes', 'on', 'enable', 'enabled'].includes(str);
    }

    // 설정 검증
    validateConfiguration() {
        const errors = [];

        // 필수 설정 검증
        if (!this.BOT_TOKEN) {
            errors.push('BOT_TOKEN이 설정되지 않았습니다');
        }

        // MongoDB URL 검증 (선택사항이지만 형식은 확인)
        if (this.MONGO_URL && !this.isValidMongoUrl(this.MONGO_URL)) {
            errors.push('MONGO_URL 형식이 올바르지 않습니다');
        }

        // 포트 번호 검증
        if (this.PORT < 1 || this.PORT > 65535) {
            errors.push('PORT 번호가 유효하지 않습니다 (1-65535)');
        }

        // 관리자 사용자 ID 검증
        if (this.ADMIN_USER_IDS.some(id => id <= 0)) {
            errors.push('관리자 사용자 ID가 유효하지 않습니다');
        }

        if (errors.length > 0) {
            throw new Error('설정 검증 실패:\n' + errors.join('\n'));
        }
    }

    // MongoDB URL 유효성 검사
    isValidMongoUrl(url) {
        return url && (url.startsWith('mongodb://') || url.startsWith('mongodb+srv://'));
    }

    // 개발 환경 여부
    get isDevelopment() {
        return this.NODE_ENV === 'development';
    }

    // 프로덕션 환경 여부
    get isProduction() {
        return this.NODE_ENV === 'production';
    }

    // Railway 환경 여부
    get isRailway() {
        return !!this.RAILWAY.DEPLOYMENT_ID;
    }

    // 현재 설정 요약 반환
    getSummary() {
        return {
            environment: this.NODE_ENV,
            version: this.VERSION,
            port: this.PORT,
            botUsername: this.BOT_USERNAME,
            mongoConfigured: !!this.MONGO_URL,
            weatherApiConfigured: !!this.WEATHER_API_KEY,
            adminUsers: this.ADMIN_USER_IDS.length,
            enabledFeatures: Object.entries(this.FEATURES)
                .filter(([, enabled]) => enabled)
                .map(([feature]) => feature),
            railway: this.isRailway,
            defaultCity: this.DONGTAN.DEFAULT_CITY
        };
    }

    // 환경 변수 마스킹하여 로그 출력용 정보 생성
    getLoggableConfig() {
        return {
            NODE_ENV: this.NODE_ENV,
            VERSION: this.VERSION,
            PORT: this.PORT,
            BOT_USERNAME: this.BOT_USERNAME,
            BOT_TOKEN: this.BOT_TOKEN ? `${this.BOT_TOKEN.slice(0, 8)}...` : 'NOT_SET',
            MONGO_URL: this.MONGO_URL ? 'CONFIGURED' : 'NOT_SET',
            WEATHER_API_KEY: this.WEATHER_API_KEY ? 'CONFIGURED' : 'NOT_SET',
            ADMIN_USER_COUNT: this.ADMIN_USER_IDS.length,
            FEATURES: this.FEATURES,
            RAILWAY: this.isRailway ? 'YES' : 'NO',
            DEFAULT_CITY: this.DONGTAN.DEFAULT_CITY
        };
    }
}

// 싱글톤 인스턴스 생성 및 내보내기
const appConfig = new AppConfig();

module.exports = appConfig;