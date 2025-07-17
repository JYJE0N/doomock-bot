// src/modules/BaseModule.js - 베이스 모듈 클래스
const Logger = require('../utils/Logger');
const { getUserName } = require('../utils/UserHelper');

class BaseModule {
    constructor(name, config = {}) {
        this.name = name;
        this.config = {
            enabled: true,
            priority: 100,
            dependencies: [],
            commands: [],
            callbacks: [],
            middleware: [],
            ...config
        };
        
        this.isInitialized = false;
        this.isLoaded = false;
        this.stats = {
            commandCount: 0,
            callbackCount: 0,
            errorCount: 0,
            lastUsed: null
        };
        
        Logger.module(this.name, 'created', { config: this.config });
    }

    // 모듈 초기화 (추상 메서드)
    async initialize() {
        try {
            Logger.module(this.name, 'initializing');
            
            // 의존성 체크
            await this.checkDependencies();
            
            // 서비스 초기화
            await this.initializeServices();
            
            // 명령어 등록
            this.registerCommands();
            
            // 콜백 등록
            this.registerCallbacks();
            
            this.isInitialized = true;
            Logger.module(this.name, 'initialized');
            
        } catch (error) {
            Logger.error(`모듈 ${this.name} 초기화 실패:`, error);
            throw error;
        }
    }

    // 의존성 체크
    async checkDependencies() {
        for (const dependency of this.config.dependencies) {
            try {
                require(dependency);
            } catch (error) {
                throw new Error(`의존성 모듈 ${dependency}을(를) 찾을 수 없습니다`);
            }
        }
    }

    // 서비스 초기화 (서브클래스에서 구현)
    async initializeServices() {
        // 서브클래스에서 구현
    }

    // 명령어 등록 (서브클래스에서 구현)
    registerCommands() {
        // 서브클래스에서 구현
    }

    // 콜백 등록 (서브클래스에서 구현)
    registerCallbacks() {
        // 서브클래스에서 구현
    }

    // 모듈 로드
    async load() {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }
            
            this.isLoaded = true;
            Logger.module(this.name, 'loaded');
            
        } catch (error) {
            Logger.error(`모듈 ${this.name} 로드 실패:`, error);
            throw error;
        }
    }

    // 모듈 언로드
    async unload() {
        try {
            Logger.module(this.name, 'unloading');
            
            // 정리 작업
            await this.cleanup();
            
            this.isLoaded = false;
            this.isInitialized = false;
            
            Logger.module(this.name, 'unloaded');
            
        } catch (error) {
            Logger.error(`모듈 ${this.name} 언로드 실패:`, error);
            throw error;
        }
    }

    // 정리 작업 (서브클래스에서 구현)
    async cleanup() {
        // 서브클래스에서 구현
    }

    // 메시지 처리 (추상 메서드)
    async handleMessage(bot, msg) {
        throw new Error(`${this.name} 모듈에서 handleMessage 메서드를 구현해야 합니다`);
    }

    // 콜백 처리 (추상 메서드)
    async handleCallback(bot, callbackQuery) {
        throw new Error(`${this.name} 모듈에서 handleCallback 메서드를 구현해야 합니다`);
    }

    // 명령어 처리 (기본 구현)
    async handleCommand(bot, msg, command, args) {
        try {
            this.updateStats('command');
            
            const result = await this.processCommand(bot, msg, command, args);
            
            Logger.userAction(msg.from.id, `${this.name}:${command}`, {
                args,
                success: true
            });
            
            return result;
            
        } catch (error) {
            this.updateStats('error');
            Logger.error(`명령어 처리 실패 [${this.name}:${command}]:`, error);
            
            await this.sendErrorMessage(bot, msg.chat.id, error);
            return false;
        }
    }

    // 실제 명령어 처리 (서브클래스에서 구현)
    async processCommand(bot, msg, command, args) {
        throw new Error(`${this.name} 모듈에서 processCommand 메서드를 구현해야 합니다`);
    }

    // 통계 업데이트
    updateStats(type) {
        switch (type) {
            case 'command':
                this.stats.commandCount++;
                break;
            case 'callback':
                this.stats.callbackCount++;
                break;
            case 'error':
                this.stats.errorCount++;
                break;
        }
        this.stats.lastUsed = new Date();
    }

    // 안전한 메시지 전송
    async sendMessage(bot, chatId, text, options = {}) {
        try {
            return await bot.sendMessage(chatId, text, options);
        } catch (error) {
            Logger.error(`메시지 전송 실패 [${this.name}]:`, error);
            throw error;
        }
    }

    // 안전한 메시지 편집
    async editMessage(bot, chatId, messageId, text, options = {}) {
        try {
            return await bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                ...options
            });
        } catch (error) {
            Logger.error(`메시지 편집 실패 [${this.name}]:`, error);
            throw error;
        }
    }

    // 오류 메시지 전송
    async sendErrorMessage(bot, chatId, error) {
        try {
            const errorMessage = this.formatErrorMessage(error);
            await this.sendMessage(bot, chatId, errorMessage, {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
                    ]]
                }
            });
        } catch (sendError) {
            Logger.error(`오류 메시지 전송 실패 [${this.name}]:`, sendError);
        }
    }

    // 오류 메시지 포맷팅
    formatErrorMessage(error) {
        const errorMessages = {
            'VALIDATION_ERROR': '❌ 입력값이 올바르지 않습니다.',
            'DATABASE_ERROR': '💾 데이터베이스 오류가 발생했습니다.',
            'API_ERROR': '🌐 외부 서비스 오류가 발생했습니다.',
            'PERMISSION_DENIED': '🚫 권한이 없습니다.',
            'RATE_LIMIT': '⏳ 요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요.',
            'MODULE_DISABLED': '🔧 이 기능은 현재 사용할 수 없습니다.'
        };

        const errorType = error.type || 'UNKNOWN';
        const customMessage = errorMessages[errorType];
        
        if (customMessage) {
            return customMessage;
        }
        
        // 개발 환경에서는 상세 오류 표시
        if (process.env.NODE_ENV === 'development') {
            return `❌ 오류 발생: ${error.message}`;
        }
        
        return '❌ 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    }

    // 사용자 권한 체크
    checkPermission(userId, permission) {
        // 기본적으로 모든 사용자에게 허용
        // 서브클래스에서 오버라이드하여 권한 체크 구현
        return true;
    }

    // 입력값 검증
    validateInput(input, rules) {
        const errors = [];
        
        for (const [field, rule] of Object.entries(rules)) {
            const value = input[field];
            
            if (rule.required && (value === undefined || value === null || value === '')) {
                errors.push(`${field}은(는) 필수입니다`);
                continue;
            }
            
            if (value !== undefined && value !== null) {
                if (rule.type && typeof value !== rule.type) {
                    errors.push(`${field}의 타입이 올바르지 않습니다`);
                }
                
                if (rule.min && value < rule.min) {
                    errors.push(`${field}은(는) ${rule.min} 이상이어야 합니다`);
                }
                
                if (rule.max && value > rule.max) {
                    errors.push(`${field}은(는) ${rule.max} 이하여야 합니다`);
                }
                
                if (rule.pattern && !rule.pattern.test(value)) {
                    errors.push(`${field}의 형식이 올바르지 않습니다`);
                }
            }
        }
        
        if (errors.length > 0) {
            const error = new Error(`입력값 검증 실패: ${errors.join(', ')}`);
            error.type = 'VALIDATION_ERROR';
            throw error;
        }
        
        return true;
    }

    // 캐시 키 생성
    getCacheKey(...parts) {
        return `${this.name}:${parts.join(':')}`;
    }

    // 한국 시간 가져오기
    getKoreaTime() {
        return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
    }

    // 메뉴 키보드 생성 헬퍼
    createMenuKeyboard(buttons, options = {}) {
        const { columns = 2, backButton = true, backCallback = 'main_menu' } = options;
        
        const keyboard = [];
        
        // 버튼들을 행으로 그룹화
        for (let i = 0; i < buttons.length; i += columns) {
            const row = buttons.slice(i, i + columns);
            keyboard.push(row);
        }
        
        // 뒤로가기 버튼 추가
        if (backButton) {
            keyboard.push([
                { text: '🔙 뒤로가기', callback_data: backCallback }
            ]);
        }
        
        return { inline_keyboard: keyboard };
    }

    // 로딩 메시지 표시
    async showLoading(bot, chatId, message = '처리 중...') {
        try {
            return await this.sendMessage(bot, chatId, `⏳ ${message}`);
        } catch (error) {
            Logger.error(`로딩 메시지 표시 실패 [${this.name}]:`, error);
            return null;
        }
    }

    // 로딩 메시지 숨기기
    async hideLoading(bot, chatId, messageId) {
        try {
            if (messageId) {
                await bot.deleteMessage(chatId, messageId);
            }
        } catch (error) {
            // 메시지 삭제 실패는 무시
        }
    }

    // 성능 측정
    measurePerformance(label) {
        return Logger.startTimer(`${this.name}:${label}`);
    }

    // 모듈 상태 조회
    getStatus() {
        return {
            name: this.name,
            enabled: this.config.enabled,
            initialized: this.isInitialized,
            loaded: this.isLoaded,
            stats: { ...this.stats },
            config: {
                priority: this.config.priority,
                commands: this.config.commands,
                callbacks: this.config.callbacks,
                dependencies: this.config.dependencies
            },
            uptime: this.stats.lastUsed ? 
                Date.now() - this.stats.lastUsed.getTime() : null
        };
    }

    // 모듈 설정 업데이트
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        Logger.module(this.name, 'config_updated', { newConfig });
    }

    // 활성화/비활성화
    setEnabled(enabled) {
        this.config.enabled = enabled;
        Logger.module(this.name, enabled ? 'enabled' : 'disabled');
    }

    // 도움말 메시지 생성 (서브클래스에서 구현)
    getHelpMessage() {
        return `🔧 **${this.name} 모듈**\n\n사용 가능한 명령어가 없습니다.`;
    }

    // 명령어 목록 조회
    getCommands() {
        return this.config.commands;
    }

    // 콜백 목록 조회
    getCallbacks() {
        return this.config.callbacks;
    }

    // 우선순위 조회
    getPriority() {
        return this.config.priority;
    }

    // 모듈이 특정 명령어를 처리할 수 있는지 확인
    canHandleCommand(command) {
        return this.config.commands.includes(command) || 
               this.config.commands.some(cmd => {
                   if (typeof cmd === 'object') {
                       return cmd.name === command || (cmd.aliases && cmd.aliases.includes(command));
                   }
                   return cmd === command;
               });
    }

    // 모듈이 특정 콜백을 처리할 수 있는지 확인
    canHandleCallback(callbackData) {
        return this.config.callbacks.some(pattern => {
            if (typeof pattern === 'string') {
                return callbackData.startsWith(pattern);
            } else if (pattern instanceof RegExp) {
                return pattern.test(callbackData);
            }
            return false;
        });
    }

    // 디버그 정보 출력
    debug(message, data = {}) {
        Logger.debug(`[${this.name}] ${message}`, data);
    }

    // 정보 로그 출력
    info(message, data = {}) {
        Logger.info(`[${this.name}] ${message}`, data);
    }

    // 경고 로그 출력
    warn(message, data = {}) {
        Logger.warn(`[${this.name}] ${message}`, data);
    }

    // 오류 로그 출력
    error(message, data = {}) {
        Logger.error(`[${this.name}] ${message}`, data);
    }

    // 사용자 액션 로그
    logUserAction(userId, action, details = {}) {
        Logger.userAction(userId, `${this.name}:${action}`, details);
    }

    // 한국어 숫자 포맷팅
    formatNumber(num) {
        return num.toLocaleString('ko-KR');
    }

    // 한국어 날짜 포맷팅
    formatDate(date) {
        return date.toLocaleDateString('ko-KR');
    }

    // 한국어 시간 포맷팅
    formatTime(date) {
        return date.toLocaleTimeString('ko-KR');
    }

    // 한국어 날짜시간 포맷팅
    formatDateTime(date) {
        return date.toLocaleString('ko-KR');
    }

    // 백분율 계산
    calculatePercentage(part, total) {
        return total > 0 ? Math.round((part / total) * 100) : 0;
    }

    // 텍스트 자르기
    truncateText(text, maxLength) {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    // 지연 함수
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 재시도 로직
    async retry(operation, maxAttempts = 3, delayMs = 1000) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                this.warn(`재시도 ${attempt}/${maxAttempts} 실패`, { error: error.message });
                
                if (attempt < maxAttempts) {
                    await this.delay(delayMs * attempt);
                }
            }
        }
        
        throw lastError;
    }

    // 페이지네이션 헬퍼
    paginate(items, page = 1, itemsPerPage = 10) {
        const totalItems = items.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const currentPage = Math.max(1, Math.min(page, totalPages));
        
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const pageItems = items.slice(startIndex, endIndex);
        
        return {
            items: pageItems,
            pagination: {
                currentPage,
                totalPages,
                totalItems,
                itemsPerPage,
                hasNext: currentPage < totalPages,
                hasPrev: currentPage > 1,
                startIndex: startIndex + 1,
                endIndex: Math.min(endIndex, totalItems)
            }
        };
    }

    // 페이지네이션 키보드 생성
    createPaginationKeyboard(callbackPrefix, pagination, extraButtons = []) {
        const buttons = [...extraButtons];
        
        if (pagination.totalPages > 1) {
            const navButtons = [];
            
            if (pagination.hasPrev) {
                navButtons.push({
                    text: '◀️ 이전',
                    callback_data: `${callbackPrefix}_page_${pagination.currentPage - 1}`
                });
            }
            
            navButtons.push({
                text: `${pagination.currentPage}/${pagination.totalPages}`,
                callback_data: 'noop'
            });
            
            if (pagination.hasNext) {
                navButtons.push({
                    text: '다음 ▶️',
                    callback_data: `${callbackPrefix}_page_${pagination.currentPage + 1}`
                });
            }
            
            buttons.push(navButtons);
        }
        
        buttons.push([{ text: '🔙 뒤로가기', callback_data: 'main_menu' }]);
        
        return { inline_keyboard: buttons };
    }

    // URL 안전성 검사
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    // 이메일 유효성 검사
    isValidEmail(email) {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailPattern.test(email);
    }

    // 전화번호 유효성 검사 (한국)
    isValidPhoneNumber(phone) {
        const phonePattern = /^01[0-9]-?[0-9]{4}-?[0-9]{4}$/;
        return phonePattern.test(phone);
    }

    // 마크다운 이스케이프
    escapeMarkdown(text) {
        return text.replace(/([_*[\]()~`>#+=|{}.!-])/g, '\\$1');
    }

    // HTML 이스케이프
    escapeHtml(text) {
        const htmlEscapes = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return text.replace(/[&<>"']/g, match => htmlEscapes[match]);
    }

    // 랜덤 선택
    randomChoice(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    // 배열 섞기
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // 객체 깊은 복사
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    // 문자열을 안전한 파일명으로 변환
    sanitizeFilename(filename) {
        return filename.replace(/[^a-z0-9가-힣._-]/gi, '_');
    }

    // 바이트를 읽기 쉬운 크기로 변환
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 상대 시간 표시 (예: "3분 전")
    getRelativeTime(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);
        
        if (diffSec < 60) return '방금 전';
        if (diffMin < 60) return `${diffMin}분 전`;
        if (diffHour < 24) return `${diffHour}시간 전`;
        if (diffDay < 7) return `${diffDay}일 전`;
        
        return this.formatDate(date);
    }

    // toString 오버라이드
    toString() {
        return `[Module: ${this.name}]`;
    }

    // JSON 직렬화를 위한 메서드
    toJSON() {
        return {
            name: this.name,
            config: this.config,
            isInitialized: this.isInitialized,
            isLoaded: this.isLoaded,
            stats: this.stats
        };
    }
}

module.exports = BaseModule;