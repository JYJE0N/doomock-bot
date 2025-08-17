class KoreanPostpositionHelper {
  static getPostposition(word, type = "이/가") {
    if (!word || typeof word !== "string") return "";

    const lastChar = word[word.length - 1];
    const lastCharCode = lastChar.charCodeAt(0);

    // 한글 범위 확인
    if (lastCharCode < 0xac00 || lastCharCode > 0xd7a3) {
      // 한글이 아닌 경우 기본값 반환
      return this.getDefaultPostposition(type, false);
    }

    // 받침 있는지 확인
    const baseCode = lastCharCode - 0xac00;
    const hasJongseong = baseCode % 28 !== 0;

    return this.getPostposition(word, type, hasJongseong);
  }

  static getPostpositionByJongseong(hasJongseong, type = "이/가") {
    switch (type) {
      case "이/가":
        return hasJongseong ? "이" : "가";
      case "을/를":
        return hasJongseong ? "을" : "를";
      case "은/는":
        return hasJongseong ? "은" : "는";
      case "과/와":
        return hasJongseong ? "과" : "와";
      case "아/야":
        return hasJongseong ? "아" : "야";
      case "으로/로":
        return hasJongseong ? "으로" : "로";
      default:
        return hasJongseong ? "이" : "가";
    }
  }

  static getDefaultPostposition(type, hasJongseong = true) {
    return this.getPostpositionByJongseong(hasJongseong, type);
  }

  static addPostposition(word, type = "이/가") {
    const postposition = this.getPostposition(word, type);
    return `${word}${postposition}`;
  }
}

module.exports = KoreanPostpositionHelper;
