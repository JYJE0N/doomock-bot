// src/database/DatabaseManager.js - 수정된 버전
const { MongoClient } = require('mongodb');
const Logger = require('../utils/Logger');

class DatabaseManager {
    constructor() {
        this.client = null;
        this.db = null;
        this.isConnected = false;
        this.reconnectInterval = null;
    }

    // MongoDB URL 설정
    setConnectionString(mongoUrl) {
        this.mongoUrl = mongoUrl;
    }

    // 데이터베이스 연결
    async connect() {
        if (this.isConnected) {
            return true;
        }

        try {
            if (!this.mongoUrl) {
                throw new Error('MongoDB URL이 설정되지 않았습니다');
            }

            Logger.info('MongoDB 연결 시도...');
            
            this.client = new MongoClient(this.mongoUrl, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                serverSelectionTimeoutMS: 5000,
                connectTimeoutMS: 10000,
                retryWrites: true
            });

            await this.client.connect();
            
            // 데이터베이스 이름 추출 및 검증
            let dbName = this.extractDbName(this.mongoUrl);
            
            // 🔧 데이터베이스 이름 검증 및 정리
            dbName = this.sanitizeDbName(dbName) || 'doomock85';
            
            this.db = this.client.db(dbName);
            
            this.isConnected = true;
            
            // 연결 상태 모니터링
            this.setupEventListeners();
            
            Logger.success(`MongoDB 연결 성공: ${dbName}`);
            return true;
            
        } catch (error) {
            Logger.error('MongoDB 연결 실패:', error);
            this.isConnected = false;
            throw error;
        }
    }

    // 데이터베이스 이름 추출
    extractDbName(mongoUrl) {
        try {
            const match = mongoUrl.match(/\/([^/?]+)(\?|$)/);
            return match ? match[1] : null;
        } catch {
            return null;
        }
    }

    // 🆕 데이터베이스 이름 정리 함수
    sanitizeDbName(dbName) {
        if (!dbName) return null;
        
        // MongoDB에서 허용하지 않는 문자들 제거/변경
        let sanitized = dbName
            .replace(/\./g, '_')           // 점을 언더스코어로
            .replace(/\s+/g, '_')          // 공백을 언더스코어로
            .replace(/[\/\\:"*?<>|]/g, '') // 특수문자 제거
            .replace(/^[._]+/, '')         // 시작부분 점이나 언더스코어 제거
            .replace(/[._]+$/, '')         // 끝부분 점이나 언더스코어 제거
            .toLowerCase();                // 소문자로 변환
        
        // 길이 제한 (MongoDB는 64바이트 제한)
        if (sanitized.length > 64) {
            sanitized = sanitized.substring(0, 64);
        }
        
        // 빈 문자열이면 기본값 반환
        if (!sanitized || sanitized.length === 0) {
            return 'doomock_bot';
        }
        
        Logger.info(`데이터베이스 이름 정리: ${dbName} → ${sanitized}`);
        return sanitized;
    }

    // 이벤트 리스너 설정
    setupEventListeners() {
        if (!this.client) return;

        this.client.on('serverClosed', () => {
            Logger.warn('MongoDB 연결이 끊어졌습니다');
            this.isConnected = false;
            this.startReconnect();
        });

        this.client.on('error', (error) => {
            Logger.error('MongoDB 에러:', error);
        });

        this.client.on('reconnected', () => {
            Logger.success('MongoDB 재연결 성공');
            this.isConnected = true;
            this.stopReconnect();
        });
    }

    // 재연결 시작
    startReconnect() {
        if (this.reconnectInterval) return;
        
        this.reconnectInterval = setInterval(async () => {
            try {
                await this.connect();
            } catch (error) {
                Logger.debug('재연결 시도 실패, 계속 시도합니다...');
            }
        }, 5000);
    }

    // 재연결 중지
    stopReconnect() {
        if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
        }
    }

    // 연결 확인
    async ensureConnection() {
        if (!this.isConnected || !this.client) {
            await this.connect();
        }
        
        // 연결 상태 확인
        try {
            await this.client.db().admin().ping();
        } catch (error) {
            this.isConnected = false;
            await this.connect();
        }
    }

    // 컬렉션 가져오기
    getCollection(collectionName) {
        if (!this.db) {
            throw new Error('데이터베이스 연결이 필요합니다');
        }
        return this.db.collection(collectionName);
    }

    // 연결 종료
    async disconnect() {
        try {
            this.stopReconnect();
            
            if (this.client) {
                await this.client.close();
                Logger.info('MongoDB 연결 종료');
            }
            
            this.client = null;
            this.db = null;
            this.isConnected = false;
            
        } catch (error) {
            Logger.error('MongoDB 연결 종료 중 오류:', error);
        }
    }

    // 상태 확인
    getStatus() {
        return {
            connected: this.isConnected,
            database: this.db ? this.db.databaseName : null,
            reconnecting: !!this.reconnectInterval
        };
    }
}

// 싱글톤 인스턴스
const instance = new DatabaseManager();

// 싱글톤 래퍼 클래스 - BotController와의 호환성 유지
class DatabaseManagerWrapper {
    constructor(mongoUrl) {
        instance.setConnectionString(mongoUrl);
    }

    async connect() {
        return instance.connect();
    }

    async disconnect() {
        return instance.disconnect();
    }

    getStatus() {
        return instance.getStatus();
    }
}

// 정적 메서드 export - 서비스 파일들과의 호환성
module.exports = {
    DatabaseManager: DatabaseManagerWrapper,
    ensureConnection: () => instance.ensureConnection(),
    getCollection: (name) => instance.getCollection(name),
    getStatus: () => instance.getStatus()
};