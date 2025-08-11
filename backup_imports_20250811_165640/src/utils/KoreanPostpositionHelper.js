/**
 * 🔎 KoreanPostpositionHelper - 한글 조사 자동 선택 헬퍼
 *
 * 단어의 마지막 글자 받침 유무에 따라 알맞은 조사를 붙여줍니다.
 */
class KoreanPostpositionHelper {
  /**
   * 단어의 마지막 글자가 받침을 가졌는지 확인합니다.
   * 숫자, 일부 영어, 특수문자를 제외한 마지막 한글 글자를 기준으로 삼습니다.
   * @param {string} word - 검사할 단어
   * @returns {boolean} 받침이 있으면 true, 없으면 false
   */
  static hasFinalConsonant(word) {
    if (typeof word !== "string" || word.length === 0) {
      return false;
    }

    const trimmedWord = word.trim();
    if (trimmedWord.length === 0) {
      return false;
    }

    // 마지막 실제 내용 문자를 찾습니다 (한글, 숫자, 영어 알파벳)
    let lastRelevantChar = "";
    for (let i = trimmedWord.length - 1; i >= 0; i--) {
      const char = trimmedWord[i];
      const charCode = char.charCodeAt(0);

      if (
        (charCode >= 0xac00 && charCode <= 0xd7a3) || // 한글 음절
        (char >= "0" && char <= "9") ||
        (char.toLowerCase() >= "a" && char.toLowerCase() <= "z")
      ) {
        lastRelevantChar = char;
        break;
      }
    }

    // 유효한 마지막 글자가 없으면 받침 없는 것으로 간주
    if (lastRelevantChar === "") {
      return false;
    }

    const lastChar = lastRelevantChar;

    // 1. 마지막 글자가 숫자인 경우, 한글 발음 기준
    if (lastChar >= "0" && lastChar <= "9") {
      // 종성(받침)으로 끝나는 숫자 발음: 0(영), 1(일), 3(삼), 6(육), 7(칠), 8(팔)
      if (["0", "1", "3", "6", "7", "8"].includes(lastChar)) {
        return true;
      }
      // 모음으로 끝나는 숫자 발음: 2(이), 4(사), 5(오), 9(구)
      return false;
    }

    // 2. 마지막 글자가 한글인 경우
    const lastCharCode = lastChar.charCodeAt(0);
    if (lastCharCode >= 0xac00 && lastCharCode <= 0xd7a3) {
      return (lastCharCode - 0xac00) % 28 !== 0;
    }

    // 3. 마지막 글자가 영어 알파벳인 경우 (일부만 처리)
    const lowerLastChar = lastChar.toLowerCase();
    if (["l", "m", "n", "r"].includes(lowerLastChar)) {
      return true;
    }

    // 그 외는 받침 없는 것으로 간주
    return false;
  }

  /**
   * 단어에 알맞은 조사를 붙여 반환합니다. (예: 이/가, 은/는, 을/를)
   * @param {string} word - 조사를 붙일 단어
   * @param {string} postposition - 조사 쌍 (예: "이/가", "은/는", "을/를")
   * @returns {string} 조사가 붙은 완전한 문자열
   */
  static a(word, postposition) {
    if (
      typeof word !== "string" ||
      typeof postposition !== "string" ||
      postposition.indexOf("/") === -1
    ) {
      return word;
    }

    const [withConsonant, withoutConsonant] = postposition.split("/");
    const hasConsonant = this.hasFinalConsonant(word);

    return word + (hasConsonant ? withConsonant : withoutConsonant);
  }
}

module.exports = KoreanPostpositionHelper;
