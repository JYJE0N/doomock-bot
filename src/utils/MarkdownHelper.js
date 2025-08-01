class MarkdownHelper {
  static escapeMarkdownV2(text) {
    // MarkdownV2에서 이스케이프가 필요한 문자들
    const specialChars = [
      "_",
      "*",
      "[",
      "]",
      "(",
      ")",
      "~",
      "`",
      ">",
      "#",
      "+",
      "-",
      "=",
      "|",
      "{",
      "}",
      ".",
      "!",
    ];
    let escapedText = text;

    specialChars.forEach((char) => {
      escapedText = escapedText.replace(
        new RegExp(`\\${char}`, "g"),
        `\\${char}`
      );
    });

    return escapedText;
  }
}

module.exports = MarkdownHelper;
