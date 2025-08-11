const fs = require('fs').promises;
const path = require('path');
const logger = require("../core/Logger");

class TTSFileHelper {
  constructor(options = {}) {
    this.baseDir = options.baseDir || path.join(process.cwd(), 'public', 'tts');
    this.maxFileAge = options.maxFileAge || 24 * 60 * 60 * 1000; // 24시간
  }

  async initialize() {
    await this.ensureDirectory();
    logger.info('TTSFileHelper 초기화 완료');
  }

  async ensureDirectory() {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  async saveFile(filename, buffer) {
    await this.ensureDirectory();
    const filePath = path.join(this.baseDir, filename);
    await fs.writeFile(filePath, buffer);
    return filePath;
  }

  async getFilePath(filename) {
    const filePath = path.join(this.baseDir, filename);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      return null;
    }
  }

  async deleteFile(filename) {
    const filePath = path.join(this.baseDir, filename);
    try {
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async cleanupOldFiles() {
    try {
      await this.ensureDirectory();
      const files = await fs.readdir(this.baseDir);
      const now = Date.now();

      for (const file of files) {
        const filePath = path.join(this.baseDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > this.maxFileAge) {
          await fs.unlink(filePath);
          logger.debug(`오래된 TTS 파일 삭제: ${file}`);
        }
      }
    } catch (error) {
      logger.error('TTS 파일 정리 실패:', error);
    }
  }

  generateFilename(text, voice = 'default') {
    const hash = require('crypto')
      .createHash('md5')
      .update(`${text}-${voice}`)
      .digest('hex');
    return `tts_${hash}.mp3`;
  }
}

module.exports = TTSFileHelper;