// src/utils/Logger.js - 로깅 유틸리티
const fs = require('fs');
const path = require('path');
const AppConfig = require('../config/AppConfig');

class Logger {
    constructor() {
        this.logLevels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3,
            trace: 4
        };
        
        this.colors = {
            error: '\x1b[31m',   // 빨강
            warn: '\x1b[33m',    // 노랑
            info: '\x1b[36m',    // 청록
            debug: '\x1b[35m',   // 자주
            trace: '\x1b[37m',   // 흰색
            success: '\x1b[32m', // 초록
            reset: '\x1b[0m'     // 리셋
        };
        
        this.emojis = {
            error: '❌',
            warn: '⚠️',
            info: 'ℹ️',
            debug: '🐛',
            trace: '🔍',
            success: '✅'
        };
        
        this.currentLevel = this.logLevels[AppConfig.LOGGING.LEVEL] || this.logLevels.info;
        this.setupLogDirectory();
    }

    // 로그 디렉토리 설정
    setupLogDirectory() {
        if (AppConfig.LOGGING.FILE_ENABLED) {
            try {
                if (!fs.existsSync(AppConfig.LOGS_DIR)) {
                    fs.mkdirSync(AppConfig.LOGS_DIR, { recursive: true });
                }
            } catch (error) {
                console.error('로그 디렉토리 생성 실패:', error);
            }
        }
    }

    // 한국 시간 포맷팅
    getKoreaTimeString() {
        const now = new Date();
        const koreaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
        return koreaTime.toISOString().replace('T', ' ').substring(0, 19);
    }

    // 로그 메시지 포맷팅
    formatMessage(level, message, metadata = {}) {
        const timestamp = this.getKoreaTimeString();
        const emoji = this.emojis[level] || '';
        const levelUpper = level.toUpperCase().padEnd(5);
        
        let formattedMessage = `[${timestamp}] [${levelUpper}] ${emoji} ${message}`;
        
        // 메타데이터가 있으면 추가
        if (metadata && Object.keys(metadata).length > 0) {
            try {
                const metaString = JSON.stringify(metadata, null, 2);
                formattedMessage += `\n메타데이터: ${metaString}`;
            } catch (error) {
                formattedMessage += `\n메타데이터: [JSON 변환 실패]`;
            }
        }
        
        return formattedMessage;
    }

    // 콘솔 출력 (색상 포함)
    logToConsole(level, formattedMessage) {
        if (!AppConfig.LOGGING.CONSOLE_ENABLED) return;
        
        const color = this.colors[level] || this.colors.reset;
        const coloredMessage = `${color}${formattedMessage}${this.colors.reset}`;
        
        if (level === 'error') {
            console.error(coloredMessage);
        } else if (level === 'warn') {
            console.warn(coloredMessage);
        } else {
            console.log(coloredMessage);
        }
    }

    // 파일 출력
    async logToFile(level, formattedMessage) {
        if (!AppConfig.LOGGING.FILE_ENABLED) return;
        
        try {
            const today = new Date().toISOString().split('T')[0];
            const logFileName = `${today}-${level}.log`;
            const logFilePath = path.join(AppConfig.LOGS_DIR, logFileName);
            
            const logEntry = formattedMessage + '\n';
            
            // 비동기로 파일에 추가
            await fs.promises.appendFile(logFilePath, logEntry, 'utf8');
            
            // 로그 파일 크기 체크 및 로테이션
            await this.rotateLogIfNeeded(logFilePath);
            
        } catch (error) {
            console.error('파일 로깅 실패:', error);
        }
    }

    // 로그 파일 로테이션
    async rotateLogIfNeeded(logFilePath) {
        try {
            const stats = await fs.promises.stat(logFilePath);
            const maxSizeBytes = this.parseLogSize(AppConfig.LOGGING.MAX_LOG_SIZE);
            
            if (stats.size > maxSizeBytes) {
                const timestamp = Date.now();
                const rotatedPath = `${logFilePath}.${timestamp}`;
                
                await fs.promises.rename(logFilePath, rotatedPath);
                
                // 오래된 로그 파일 정리
                await this.cleanOldLogs();
            }
        } catch (error) {
            // 파일이 없거나 접근할 수 없는 경우 무시
        }
    }

    // 오래된 로그 파일 정리
    async cleanOldLogs() {
        try {
            const files = await fs.promises.readdir(AppConfig.LOGS_DIR);
            const logFiles = files
                .filter(file => file.endsWith('.log') && file.includes('-'))
                .map(file => ({
                    name: file,
                    path: path.join(AppConfig.LOGS_DIR, file),
                    timestamp: fs.statSync(path.join(AppConfig.LOGS_DIR, file)).mtime
                }))
                .sort((a, b) => b.timestamp - a.timestamp);
            
            // 최대 파일 수를 초과하는 파일들 삭제
            if (logFiles.length > AppConfig.LOGGING.MAX_LOG_FILES) {
                const filesToDelete = logFiles.slice(AppConfig.LOGGING.MAX_LOG_FILES);
                
                for (const file of filesToDelete) {
                    await fs.promises.unlink(file.path);
                }
            }
        } catch (error) {
            console.error('오래된 로그 파일 정리 실패:', error);
        }
    }

    // 로그 크기 파싱 (예: "10MB" -> 10485760)
    parseLogSize(sizeStr) {
        const units = {
            'B': 1,
            'KB': 1024,
            'MB': 1024 * 1024,
            'GB': 1024 * 1024 * 1024
        };
        
        const match = sizeStr.match(/^(\d+)([KMGT]?B)$/i);
        if (!match) return 10 * 1024 * 1024; // 기본값 10MB
        
        const size = parseInt(match[1]);
        const unit = match[2].toUpperCase();
        
        return size * (units[unit] || 1);
    }

    // 기본 로그 메서드
    log(level, message, metadata = {}) {
        // 로그 레벨 체크
        if (this.logLevels[level] > this.currentLevel) {
            return;
        }
        
        const formattedMessage = this.formatMessage(level, message, metadata);
        
        // 콘솔 출력
        this.logToConsole(level, formattedMessage);
        
        // 파일 출력 (비동기)
        this.logToFile(level, formattedMessage).catch(error => {
            console.error('파일 로깅 실패:', error);
        });
    }

    // 레벨별 메서드들
    error(message, metadata) {
        this.log('error', message, metadata);
        
        // 에러의 경우 스택 트레이스도 포함
        if (metadata instanceof Error) {
            this.log('error', `Stack trace: ${metadata.stack}`);
        }
    }

    warn(message, metadata) {
        this.log('warn', message, metadata);
    }

    info(message, metadata) {
        this.log('info', message, metadata);
    }

    debug(message, metadata) {
        this.log('debug', message, metadata);
    }

    trace(message, metadata) {
        this.log('trace', message, metadata);
    }

    success(message, metadata) {
        this.log('success', message, metadata);
    }

    // Railway 전용 로깅 메서드
    railway(message, metadata = {}) {
        const railwayMeta = {
            ...metadata,
            deployment_id: AppConfig.RAILWAY.DEPLOYMENT_ID,
            service_id: AppConfig.RAILWAY.SERVICE_ID,
            environment: AppConfig.RAILWAY.ENVIRONMENT
        };
        
        this.info(`🚂 ${message}`, railwayMeta);
    }

    // 사용자 액션 로깅
    userAction(userId, action, details = {}) {
        this.info(`👤 사용자 액션`, {
            userId,
            action,
            ...details,
            timestamp: new Date().toISOString()
        });
    }

    // 모듈 이벤트 로깅
    module(moduleName, event, details = {}) {
        this.info(`🔧 모듈 이벤트`, {
            module: moduleName,
            event,
            ...details
        });
    }

    // API 호출 로깅
    api(service, endpoint, status, responseTime, details = {}) {
        const level = status >= 400 ? 'error' : status >= 300 ? 'warn' : 'info';
        
        this.log(level, `🌐 API 호출`, {
            service,
            endpoint,
            status,
            responseTime: `${responseTime}ms`,
            ...details
        });
    }

    // 성능 측정 시작
    startTimer(label) {
        const start = process.hrtime.bigint();
        
        return {
            end: (details = {}) => {
                const end = process.hrtime.bigint();
                const duration = Number(end - start) / 1000000; // 나노초를 밀리초로 변환
                
                this.debug(`⏱️ 성능 측정: ${label}`, {
                    duration: `${duration.toFixed(2)}ms`,
                    ...details
                });
                
                return duration;
            }
        };
    }

    // 현재 로그 레벨 설정
    setLevel(level) {
        if (this.logLevels.hasOwnProperty(level)) {
            this.currentLevel = this.logLevels[level];
            this.info(`로그 레벨 변경: ${level}`);
        } else {
            this.warn(`알 수 없는 로그 레벨: ${level}`);
        }
    }

    // 로그 통계 조회
    async getLogStats() {
        if (!AppConfig.LOGGING.FILE_ENABLED) {
            return { error: '파일 로깅이 비활성화되어 있습니다' };
        }

        try {
            const files = await fs.promises.readdir(AppConfig.LOGS_DIR);
            const logFiles = files.filter(file => file.endsWith('.log'));
            
            const stats = {
                totalFiles: logFiles.length,
                files: [],
                totalSize: 0
            };
            
            for (const file of logFiles) {
                const filePath = path.join(AppConfig.LOGS_DIR, file);
                const fileStat = await fs.promises.stat(filePath);
                
                stats.files.push({
                    name: file,
                    size: fileStat.size,
                    modified: fileStat.mtime,
                    sizeFormatted: this.formatBytes(fileStat.size)
                });
                
                stats.totalSize += fileStat.size;
            }
            
            stats.totalSizeFormatted = this.formatBytes(stats.totalSize);
            return stats;
            
        } catch (error) {
            return { error: error.message };
        }
    }

    // 바이트를 읽기 쉬운 형태로 변환
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}



// 싱글톤 인스턴스 생성 및 내보내기
const logger = new Logger();

module.exports = logger;