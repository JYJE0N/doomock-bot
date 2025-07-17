// src/services/TTSService.js - TTS 음성 변환 서비스

const gtts = require('gtts');
const fs = require('fs');
const path = require('path');

class TTSService {
    constructor() {
        this.supportedLanguages = {
            'ko': '한국어',
            'en': 'English', 
            'ja': '日本語',
            'zh': '中文',
            'es': 'Español',
            'fr': 'Français'
        };
        
        this.defaultLanguage = 'ko';
        this.tempDir = './temp';
        
        // temp 디렉토리 생성
        this.ensureTempDir();
    }

    // temp 디렉토리 확인/생성
    ensureTempDir() {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    // 텍스트를 음성으로 변환
    async convertTextToSpeech(text, language = 'ko', options = {}) {
        return new Promise((resolve, reject) => {
            try {
                // 텍스트 길이 제한 (200자)
                if (text.length > 200) {
                    text = text.substring(0, 200) + '...';
                }

                // 언어 검증
                if (!this.supportedLanguages[language]) {
                    language = this.defaultLanguage;
                }

                // GTTS 인스턴스 생성
                const tts = new gtts(text, language);
                
                // 파일명 생성 (타임스탬프 기반)
                const timestamp = Date.now();
                const fileName = `tts_${timestamp}.mp3`;
                const filePath = path.join(this.tempDir, fileName);

                // 음성 파일 생성
                tts.save(filePath, (error) => {
                    if (error) {
                        reject(new Error(`TTS 변환 실패: ${error.message}`));
                    } else {
                        resolve({
                            success: true,
                            filePath: filePath,
                            fileName: fileName,
                            language: language,
                            text: text,
                            size: this.getFileSize(filePath)
                        });
                    }
                });

            } catch (error) {
                reject(new Error(`TTS 처리 중 오류: ${error.message}`));
            }
        });
    }

    // 파일 크기 확인
    getFileSize(filePath) {
        try {
            const stats = fs.statSync(filePath);
            return stats.size;
        } catch (error) {
            return 0;
        }
    }

    // 파일 정리 (임시 파일 삭제)
    async cleanupFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                return true;
            }
        } catch (error) {
            console.error('파일 삭제 실패:', error);
        }
        return false;
    }

    // 지원 언어 목록 반환
    getSupportedLanguages() {
        return this.supportedLanguages;
    }

    // 언어 감지 (간단한 휴리스틱)
    detectLanguage(text) {
        // 한글 포함 체크
        if (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text)) {
            return 'ko';
        }
        
        // 일본어 체크
        if (/[ひらがな|カタカナ]/.test(text)) {
            return 'ja';
        }
        
        // 중국어 체크 (간체/번체)
        if (/[\u4e00-\u9fff]/.test(text)) {
            return 'zh';
        }
        
        // 기본값: 영어
        return 'en';
    }

    // 텍스트 전처리
    preprocessText(text) {
        // 특수문자 정리
        text = text.replace(/[^\w\s\u3131-\uD79D]/giu, '');
        
        // 연속 공백 제거
        text = text.replace(/\s+/g, ' ').trim();
        
        // 빈 텍스트 체크
        if (!text || text.length === 0) {
            throw new Error('변환할 텍스트가 없습니다');
        }
        
        return text;
    }

    // 자동 TTS 처리 (설정에 따라)
    async processAutoTTS(text, userSettings = {}) {
        try {
            // 사용자 설정 확인
            const language = userSettings.language || this.detectLanguage(text);
            const maxLength = userSettings.maxLength || 100;
            
            // 텍스트 길이 체크
            if (text.length > maxLength) {
                return {
                    success: false,
                    reason: 'TEXT_TOO_LONG',
                    message: `텍스트가 너무 깁니다 (최대 ${maxLength}자)`
                };
            }
            
            // 전처리
            const processedText = this.preprocessText(text);
            
            // TTS 변환
            const result = await this.convertTextToSpeech(processedText, language);
            
            return {
                ...result,
                autoDetectedLanguage: language
            };
            
        } catch (error) {
            return {
                success: false,
                reason: 'PROCESSING_ERROR',
                message: error.message
            };
        }
    }

    // 임시 파일 정리 (오래된 파일들)
    async cleanupOldFiles(maxAge = 3600000) { // 1시간
        try {
            const files = fs.readdirSync(this.tempDir);
            const now = Date.now();
            
            let cleanedCount = 0;
            
            for (const file of files) {
                if (file.startsWith('tts_') && file.endsWith('.mp3')) {
                    const filePath = path.join(this.tempDir, file);
                    const stats = fs.statSync(filePath);
                    
                    if (now - stats.mtime.getTime() > maxAge) {
                        fs.unlinkSync(filePath);
                        cleanedCount++;
                    }
                }
            }
            
            return cleanedCount;
            
        } catch (error) {
            console.error('파일 정리 중 오류:', error);
            return 0;
        }
    }

    // TTS 설정 검증
    validateTTSRequest(text, language) {
        const errors = [];
        
        if (!text || typeof text !== 'string') {
            errors.push('텍스트가 필요합니다');
        }
        
        if (text && text.length > 200) {
            errors.push('텍스트가 너무 깁니다 (최대 200자)');
        }
        
        if (language && !this.supportedLanguages[language]) {
            errors.push(`지원되지 않는 언어입니다: ${language}`);
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    // 서비스 상태 확인
    getServiceStatus() {
        return {
            status: 'active',
            supportedLanguages: Object.keys(this.supportedLanguages).length,
            tempDir: this.tempDir,
            tempDirExists: fs.existsSync(this.tempDir)
        };
    }
}

module.exports = TTSService;