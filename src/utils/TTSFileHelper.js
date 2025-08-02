// src/utils/TTSFileHelper.js
const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const logger = require("./Logger");

class TTSFileHelper {
  constructor() {
    this.tempDir = path.join(process.cwd(), "temp", "tts");
    this.shareDir = path.join(process.cwd(), "public", "tts");
  }

  async initialize() {
    await this.ensureDirectories();
    logger.info("📂 TTSFileHelper 초기화 완료");
  }

  async ensureDirectories() {
    for (const dir of [this.tempDir, this.shareDir]) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        logger.error(`디렉토리 생성 실패: ${dir}`, error);
      }
    }
  }

  generateFileName(userId, text) {
    const hash = crypto
      .createHash("md5")
      .update(`${userId}-${text}-${Date.now()}`)
      .digest("hex")
      .substring(0, 8);
    return `tts_${hash}.mp3`;
  }

  async saveAudioFile(audioBuffer, fileName) {
    const tempPath = path.join(this.tempDir, fileName);
    const sharePath = path.join(this.shareDir, fileName);

    // 디렉토리가 있는지 다시 확인
    await this.ensureDirectories();

    await fs.writeFile(tempPath, audioBuffer);
    await fs.copyFile(tempPath, sharePath);

    logger.debug("오디오 파일 저장 완료:", {
      tempPath,
      sharePath,
      exists: await fs
        .access(tempPath)
        .then(() => true)
        .catch(() => false),
    });

    return {
      tempPath,
      sharePath,
      shareUrl: `/tts/${fileName}`,
    };
  }

  async cleanupOldFiles() {
    const maxAge = 24 * 60 * 60 * 1000; // 24시간
    const now = Date.now();

    for (const dir of [this.tempDir, this.shareDir]) {
      const files = await fs.readdir(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = await fs.stat(filePath);
        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filePath).catch(() => {});
        }
      }
    }
  }
}

module.exports = TTSFileHelper;
