// src/utils/FancyBanner.js - 화려한 DooMock 배너 시스템
const chalk = require("chalk");
const figlet = require("figlet");

/**
 * 🎨 FancyBanner - 터미널에 화려한 배너 표시
 *
 * 여러가지 ASCII 아트 스타일과 그라디언트 효과로
 * DooMock Bot을 멋지게 표시합니다!
 */
class FancyBanner {
  constructor() {
    this.bannerStyles = {
      // Figlet 폰트 스타일들
      fonts: [
        "Big", // 크고 굵은 스타일
        "Doom", // Doom 스타일 (이름에 맞게!)
        "Epic", // Epic한 스타일
        "Larry 3D", // 3D 효과
        "Standard", // 표준 스타일
        "Slant", // 기울어진 스타일
        "Speed", // 스피드감 있는 스타일
        "Starwars", // 스타워즈 스타일
        "Block", // 블록 스타일
        "Colossal" // 거대한 스타일
      ]
    };

    // 레인보우 색상 배열
    this.rainbowColors = ["red", "yellow", "green", "cyan", "blue", "magenta"];

    // 그라디언트 색상 조합
    this.gradientPresets = [
      { start: "#FF6B6B", end: "#4ECDC4" }, // 빨강 → 청록
      { start: "#F7B731", end: "#5C7CFA" }, // 노랑 → 파랑
      { start: "#00D2FF", end: "#3A7BD5" }, // 하늘색 → 파랑
      { start: "#F093FB", end: "#F5576C" }, // 보라 → 분홍
      { start: "#FA709A", end: "#FEE140" }, // 분홍 → 노랑
      { start: "#30CFD0", end: "#330867" }, // 청록 → 보라
      { start: "#A8EDEA", end: "#FED6E3" }, // 민트 → 분홍
      { start: "#FF9A9E", end: "#FECFEF" }, // 연분홍 그라디언트
      { start: "#667EEA", end: "#764BA2" }, // 보라 그라디언트
      { start: "#F093FB", end: "#F5576C" } // 네온 핑크
    ];
  }

  /**
   * 🎨 메인 배너 표시
   */
  async showMainBanner(version = "4.0.1") {
    console.clear(); // 화면 클리어 (선택사항)

    console.log("\n"); // 상단 여백

    // 상단 구분선 (더 굵고 화려하게)
    this.printThickBorder("top");

    console.log(""); // 여백

    // 메인 타이틀 - 더 크고 선명하게
    await this.printFigletText("DOOMOCK", {
      font: "Larry 3D", // Big 폰트가 더 선명함
      style: "neonRainbow" // 새로운 네온 레인보우 스타일
    });

    console.log(""); // 여백

    // 서브 타이틀 - 박스 안에
    this.printBoxedText("Business Assistant Bot", "gradient");

    // 버전 정보 - 강조
    this.printCenteredText(`Version ${version}`, 60, "highlight");

    console.log(""); // 여백

    // 하단 구분선
    this.printThickBorder("bottom");

    console.log(""); // 여백

    // 추가 정보 (개선된 버전)
    this.printEnhancedStartupInfo();
  }

  /**
   * 📝 Figlet 텍스트 출력
   */
  async printFigletText(text, options = {}) {
    const { font = "Doom", style = "rainbow" } = options;

    return new Promise((resolve) => {
      figlet.text(
        text,
        {
          font: font,
          horizontalLayout: "default",
          verticalLayout: "default",
          width: 80,
          whitespaceBreak: true
        },
        (err, data) => {
          if (err) {
            console.log(chalk.bold.red(text)); // 폴백
            resolve();
            return;
          }

          // 스타일 적용
          switch (style) {
            case "rainbow":
              this.printRainbow(data);
              break;
            case "gradient":
              this.printGradient(data);
              break;
            case "neon":
              this.printNeon(data);
              break;
            case "neonRainbow":
              this.printNeonRainbow(data);
              break;
            default:
              console.log(chalk.cyan.bold(data));
          }

          resolve();
        }
      );
    });
  }

  /**
   * 🌈 레인보우 텍스트 출력
   */
  printRainbow(text) {
    const lines = text.split("\n");
    lines.forEach((line, lineIndex) => {
      let coloredLine = "";
      for (let i = 0; i < line.length; i++) {
        const colorIndex = (i + lineIndex) % this.rainbowColors.length;
        coloredLine += chalk.bold[this.rainbowColors[colorIndex]](line[i]); // bold 추가
      }
      console.log(coloredLine);
    });
  }

  /**
   * 🌟 네온 레인보우 효과 (새로운!)
   */
  printNeonRainbow(text) {
    const neonColors = ["redBright", "yellowBright", "greenBright", "cyanBright", "blueBright", "magentaBright"];
    const lines = text.split("\n");

    lines.forEach((line, lineIndex) => {
      let coloredLine = "";
      for (let i = 0; i < line.length; i++) {
        const colorIndex = (i + lineIndex) % neonColors.length;
        coloredLine += chalk.bold[neonColors[colorIndex]](line[i]);
      }
      console.log(coloredLine);
    });
  }

  /**
   * 🌅 그라디언트 텍스트 출력
   */
  printGradient(text, preset = null) {
    const gradientColors = preset || this.gradientPresets[0];
    const lines = text.split("\n");

    lines.forEach((line) => {
      let coloredLine = "";
      const midPoint = Math.floor(line.length / 2);

      // 시작 색상에서 끝 색상으로 그라디언트
      for (let i = 0; i < line.length; i++) {
        if (i < midPoint) {
          coloredLine += chalk.hex(gradientColors.start)(line[i]);
        } else {
          coloredLine += chalk.hex(gradientColors.end)(line[i]);
        }
      }
      console.log(coloredLine);
    });
  }

  /**
   * 💫 네온 효과 텍스트
   */
  printNeon(text) {
    const lines = text.split("\n");
    lines.forEach((line) => {
      // 네온 효과: 밝은 색상 + 굵게
      console.log(chalk.bold.magentaBright(line));
    });
  }

  /**
   * 📏 중앙 정렬 텍스트 (개선된 버전)
   */
  printCenteredText(text, width = 60, style = "normal") {
    const padding = Math.floor((width - text.length) / 2);
    const centeredText = " ".repeat(padding) + text;

    switch (style) {
      case "rainbow":
        this.printRainbow(centeredText);
        break;
      case "gradient":
        this.printGradient(centeredText);
        break;
      case "fade":
        console.log(chalk.gray(centeredText));
        break;
      case "highlight":
        console.log(chalk.bold.whiteBright(centeredText));
        break;
      default:
        console.log(chalk.white(centeredText));
    }
  }

  /**
   * ➖ 구분선 출력
   */
  printSeparator(char = "═", length = 60, style = "normal") {
    const separator = char.repeat(length);

    switch (style) {
      case "rainbow":
        this.printRainbow(separator);
        break;
      case "gradient":
        this.printGradient(separator);
        break;
      default:
        console.log(chalk.gray(separator));
    }
  }

  /**
   * 🎯 굵은 테두리
   */
  printThickBorder(position = "top") {
    const width = 70;
    const char = position === "top" ? "▀" : "▄";
    let border = "";

    for (let i = 0; i < width; i++) {
      const colorIndex = i % this.rainbowColors.length;
      border += chalk.bold[this.rainbowColors[colorIndex]](char);
    }

    console.log(border);
  }

  /**
   * 🎯 박스 안에 텍스트
   */
  printBoxedText(text, style = "normal") {
    const padding = 4;
    const boxWidth = text.length + padding * 2 + 2;

    // 상단 테두리
    console.log(chalk.white("╔" + "═".repeat(boxWidth - 2) + "╗"));

    // 텍스트 라인
    const paddedText = " ".repeat(padding) + text + " ".repeat(padding);
    const textLine = "║" + paddedText + "║";

    switch (style) {
      case "gradient":
        this.printGradient(textLine);
        break;
      case "rainbow":
        this.printRainbow(textLine);
        break;
      default:
        console.log(chalk.white(textLine));
    }

    // 하단 테두리
    console.log(chalk.white("╚" + "═".repeat(boxWidth - 2) + "╝"));
  }

  /**
   * 📊 개선된 시작 정보 출력
   */
  printEnhancedStartupInfo() {
    const boxWidth = 50;

    // 정보 박스 시작
    console.log(chalk.gray("┌" + "─".repeat(boxWidth - 2) + "┐"));

    const info = [
      {
        icon: "🌍",
        label: "Environment",
        value: process.env.NODE_ENV || "development",
        color: "cyanBright"
      },
      {
        icon: "🚂",
        label: "Railway",
        value: process.env.RAILWAY_ENVIRONMENT ? "Yes" : "No",
        color: "magentaBright"
      },
      {
        icon: "🕐",
        label: "Started",
        value: new Date().toLocaleString("ko-KR"),
        color: "yellowBright"
      },
      {
        icon: "💾",
        label: "Memory",
        value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        color: "greenBright"
      },
      {
        icon: "📦",
        label: "Node.js",
        value: process.version,
        color: "blueBright"
      }
    ];

    info.forEach((item) => {
      const content = ` ${item.icon} ${item.label}: ${item.value}`;
      const padding = boxWidth - content.length - 1;
      const line = "│" + chalk.bold[item.color](content) + " ".repeat(Math.max(0, padding)) + "│";
      console.log(chalk.gray(line));
    });

    // 정보 박스 끝
    console.log(chalk.gray("└" + "─".repeat(boxWidth - 2) + "┘"));
  }

  /**
   * 📊 시작 정보 출력 (기본)
   */
  printStartupInfo() {
    console.log("");

    const info = [
      {
        icon: "🌍",
        label: "Environment",
        value: process.env.NODE_ENV || "development"
      },
      {
        icon: "🚂",
        label: "Railway",
        value: process.env.RAILWAY_ENVIRONMENT ? "Yes" : "No"
      },
      {
        icon: "🕐",
        label: "Started",
        value: new Date().toLocaleString("ko-KR")
      },
      {
        icon: "💾",
        label: "Memory",
        value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
      }
    ];

    info.forEach((item, index) => {
      const line = `${item.icon} ${item.label}: ${item.value}`;
      const colors = ["cyan", "magenta", "yellow", "green"];
      console.log(chalk[colors[index % colors.length]](line));
    });

    console.log("");
  }

  /**
   * 🎯 간단한 배너 (작은 버전)
   */
  showSimpleBanner(text) {
    const rainbowText = text
      .split("")
      .map((char, i) => {
        return chalk[this.rainbowColors[i % this.rainbowColors.length]](char);
      })
      .join("");

    console.log("\n" + "🎉 " + rainbowText + " 🎉\n");
  }

  /**
   * 🚀 모듈 시작 배너
   */
  showModuleBanner(moduleName, icon = "📦") {
    const bannerText = `${icon} ${moduleName.toUpperCase()} MODULE`;
    const width = bannerText.length + 10;

    this.printSeparator("─", width, "gradient");
    this.printCenteredText(bannerText, width, "rainbow");
    this.printSeparator("─", width, "gradient");
  }
}

// 싱글톤 인스턴스
const fancyBanner = new FancyBanner();

// 사용 예제 함수들
async function showDoomockBanner() {
  await fancyBanner.showMainBanner();
}

function showModuleBanner(moduleName, icon) {
  fancyBanner.showModuleBanner(moduleName, icon);
}

module.exports = {
  FancyBanner,
  fancyBanner,
  showDoomockBanner,
  showModuleBanner
};
