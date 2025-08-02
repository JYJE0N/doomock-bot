// src/utils/TTSVoiceConfig.js

class TTSVoiceConfig {
  constructor() {
    this.voices = {
      "ko-KR": {
        male: [
          {
            code: "ko-KR-Wavenet-C",
            name: "광렬",
            description: "중후한 목소리",
          },
          {
            code: "ko-KR-Wavenet-D",
            name: "민철",
            description: "친근한 목소리",
          },
          {
            code: "ko-KR-Standard-C",
            name: "달식",
            description: "활기찬 목소리",
          },
        ],
        female: [
          {
            code: "ko-KR-Wavenet-A",
            name: "경자",
            description: "차분한 목소리",
          },
          { code: "ko-KR-Wavenet-B", name: "영희", description: "밝은 목소리" },
          {
            code: "ko-KR-Standard-A",
            name: "순자",
            description: "정감있는 목소리",
          },
        ],
      },
      "en-US": {
        male: [
          {
            code: "en-US-Wavenet-D",
            name: "James",
            description: "Professional",
          },
          { code: "en-US-Wavenet-A", name: "Michael", description: "Friendly" },
          {
            code: "en-US-Standard-B",
            name: "Robert",
            description: "Energetic",
          },
        ],
        female: [
          { code: "en-US-Wavenet-F", name: "Emma", description: "Warm" },
          { code: "en-US-Wavenet-E", name: "Olivia", description: "Clear" },
          {
            code: "en-US-Standard-C",
            name: "Sophia",
            description: "Professional",
          },
        ],
      },
    };

    this.defaultVoice = {
      "ko-KR": "ko-KR-Wavenet-A",
      "en-US": "en-US-Wavenet-F",
    };
  }

  getVoices(language) {
    return this.voices[language] || {};
  }

  getVoiceByCode(code) {
    for (const [lang, voices] of Object.entries(this.voices)) {
      for (const [gender, voiceList] of Object.entries(voices)) {
        const voice = voiceList.find((v) => v.code === code);
        if (voice) return { ...voice, language: lang, gender };
      }
    }
    return null;
  }

  getDefaultVoice(language) {
    return this.defaultVoice[language];
  }
}

module.exports = TTSVoiceConfig;
