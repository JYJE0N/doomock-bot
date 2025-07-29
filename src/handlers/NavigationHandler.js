// src/handlers/NavigationHandler.js - 안정화된 최종 버전

const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const { getEnabledModules } = require("../config/ModuleRegistry");

class NavigationHandler {
  constructor() {
    this.bot = null;
    this.moduleManager = null;
  }

  initialize(bot) {
    this.bot = bot;
    logger.info("🎹 NavigationHandler가 초기화되었습니다.");
  }

  setModuleManager(moduleManager) {
    this.moduleManager = moduleManager;
  }

  escapeMarkdownV2(text) {
    if (typeof text !== "string") text = String(text);

    // MarkdownV2에서 이스케이프가 필요한 문자들
    const escapeChars = [
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

    // 각 문자를 백슬래시와 함께 이스케이프
    let escaped = text;
    escapeChars.forEach((char) => {
      const regex = new RegExp("\\" + char, "g");
      escaped = escaped.replace(regex, "\\" + char);
    });

    return escaped;
  }

  async handleCallback(ctx) {
    try {
      await ctx.answerCbQuery();
      const callbackQuery = ctx.callbackQuery;
      const data = callbackQuery.data;

      if (data === "system:menu") {
        return await this.showMainMenu(ctx);
      }

      const [moduleKey, subAction = "menu", ...params] = data.split(":");
      const result = await this.moduleManager.handleCallback(
        this.bot,
        callbackQuery,
        moduleKey,
        subAction,
        params.join(":")
      );

      if (result) {
        await this.renderResponse(ctx, result);
      } else {
        logger.warn(
          `모듈 [${moduleKey}]에서 콜백 [${subAction}]에 대한 렌더링 결과가 없습니다.`
        );
      }
    } catch (error) {
      logger.error("네비게이션 콜백 처리 실패:", error);
      await this.showNavigationError(ctx, error);
    }
  }

  /**
   * 🎨 모듈의 결과를 받아 UI를 렌더링하는 중앙 함수
   */
  async renderResponse(ctx, result) {
    const chatId = ctx.chat.id;
    const messageId = ctx.callbackQuery.message.message_id;

    if (!result || result.type === "error") {
      return this.showNavigationError(
        ctx,
        new Error(result?.message || "알 수 없는 오류")
      );
    }

    let text = `*${this.escapeMarkdownV2(result.module)} 모듈*\n\n`;
    const keyboard = { inline_keyboard: [] };

    // --- ⬇️ 여기에 TodoModule을 위한 case를 추가합니다 ⬇️ ---
    switch (`${result.module}:${result.type}`) {
      // [추가] TodoModule 목록 렌더링
      case "todo:list":
        text += "📋 *할 일 목록*\n";
        const todos = result.data?.todos || [];

        if (todos.length === 0) {
          text += "\n할 일이 없습니다\\. 새 할 일을 추가해보세요\\!";
        } else {
          todos.forEach((todo) => {
            const statusIcon = todo.completed ? "✅" : "⬜️";
            // 각 할 일에 대한 토글/삭제 버튼
            keyboard.inline_keyboard.push([
              {
                text: `${statusIcon} ${this.escapeMarkdownV2(todo.text)}`,
                callback_data: `todo:toggle:${todo.id}`,
              },
              { text: "🗑️", callback_data: `todo:delete:${todo.id}` },
            ]);
          });
        }
        // 목록 하단에 '할 일 추가' 버튼 추가
        keyboard.inline_keyboard.push([
          { text: "➕ 할 일 추가", callback_data: "todo:add_prompt" },
        ]);
        break;

      // [추가] TodoModule 추가 안내 렌더링
      case "todo:add_prompt":
        text =
          "✍️ *할 일 추가*\n\n채팅창에 새로운 할 일 내용을 입력해주세요\\.";
        // '뒤로 가기' 버튼만 표시
        keyboard.inline_keyboard.push([
          { text: "◀️ 목록으로 돌아가기", callback_data: "todo:list" },
        ]);
        break;

      // ... 다른 모듈들의 case ...

      case "weather:menu":
        const menuWeather = result.data?.weather;
        text = `🌤️ **날씨 정보**\n\n`;

        if (menuWeather) {
          // ✅ 안전한 이스케이프 처리
          const safeLocation = this.escapeMarkdownV2(menuWeather.location);
          const safeDescription = this.escapeMarkdownV2(
            menuWeather.description
          );

          text += `📍 **${safeLocation}**\n`;
          text += `🌡️ ${menuWeather.temperature}°C ${menuWeather.icon}\n`;
          text += `💭 ${safeDescription}\n\n`;
          text += `💧 습도: ${menuWeather.humidity}%\n`;
          text += `💨 바람: ${menuWeather.windSpeed}m/s\n`;
          text += `📊 기압: ${menuWeather.pressure}hPa\n\n`;

          if (menuWeather.isDummy) {
            text += `⚠️ *더미 데이터입니다*\n`;
          } else if (menuWeather.source === "openweathermap") {
            text += `📡 *실시간 날씨 정보*\n`;
          }
        }

        text += `원하는 기능을 선택해주세요\\!`;
        break;

      case "weather:current":
        const currentWeather = result.data?.weather;
        text = `🌡️ **현재 날씨**\n\n`;

        if (currentWeather) {
          // ✅ 안전한 이스케이프 처리
          const safeLocation = this.escapeMarkdownV2(currentWeather.location);
          const safeDescription = this.escapeMarkdownV2(
            currentWeather.description
          );

          text += `📍 **${safeLocation}**`;
          if (currentWeather.country) {
            text += ` \\(${currentWeather.country}\\)`;
          }
          text += `\n\n`;

          text += `${currentWeather.icon} **${currentWeather.temperature}°C**\n`;
          text += `💭 ${safeDescription}\n\n`;

          // 상세 정보 (숫자는 이스케이프 불필요)
          text += `**📊 상세 정보**\n`;
          text += `🌡️ 체감온도: ${
            currentWeather.feelsLike || currentWeather.temperature
          }°C\n`;
          text += `💧 습도: ${currentWeather.humidity}%\n`;
          text += `💨 바람: ${currentWeather.windSpeed}m/s\n`;
          text += `📊 기압: ${currentWeather.pressure}hPa\n`;

          if (currentWeather.visibility) {
            text += `👁️ 가시거리: ${currentWeather.visibility}km\n`;
          }

          if (currentWeather.cloudiness !== undefined) {
            text += `☁️ 구름: ${currentWeather.cloudiness}%\n`;
          }

          text += `\n`;

          // 시간 정보
          if (currentWeather.sunrise && currentWeather.sunset) {
            const sunrise = new Date(currentWeather.sunrise).toLocaleTimeString(
              "ko-KR",
              {
                hour: "2-digit",
                minute: "2-digit",
              }
            );
            const sunset = new Date(currentWeather.sunset).toLocaleTimeString(
              "ko-KR",
              {
                hour: "2-digit",
                minute: "2-digit",
              }
            );
            text += `🌅 일출: ${sunrise}\n`;
            text += `🌇 일몰: ${sunset}\n\n`;
          }

          // 데이터 출처
          if (currentWeather.source === "openweathermap") {
            text += `📡 *OpenWeatherMap 제공*\n`;
          } else if (currentWeather.isDummy) {
            text += `⚠️ *더미 데이터*\n`;
          }

          // ✅ 안전한 시간 포맷팅
          const updateTime = new Date(currentWeather.timestamp).toLocaleString(
            "ko-KR"
          );
          const safeUpdateTime = this.escapeMarkdownV2(updateTime);
          text += `⏰ 업데이트: ${safeUpdateTime}`;
        } else {
          text += `❌ 날씨 정보를 가져올 수 없습니다\\.`;
        }
        break;

      //TTS 인라인 키보드
      // TTS 메인 메뉴
      case "tts:menu":
        const ttsData = result.data;
        text = `🔊 **TTS 음성변환**\n\n`;

        if (ttsData?.isServiceActive) {
          text += `✅ **서비스 상태**: 정상 동작\n`;
          text += `🌍 **기본 언어**: ${ttsData.defaultLanguage || "ko-KR"}\n\n`;

          if (ttsData.stats) {
            text += `📊 **변환 통계**\n`;
            text += `🔢 총 변환 횟수: ${ttsData.stats.totalConversions}회\n`;
            if (ttsData.stats.lastConversion) {
              const lastDate = new Date(
                ttsData.stats.lastConversion
              ).toLocaleDateString("ko-KR");
              text += `📅 마지막 변환: ${lastDate}\n`;
            }
            text += `\n`;
          }
        } else {
          text += `⚠️ **서비스 상태**: 비활성\n\n`;
        }

        text += `원하는 기능을 선택해주세요\\!`;

        keyboard.inline_keyboard = [
          [
            { text: "🎤 텍스트 변환", callback_data: "tts:convert" },
            { text: "🎭 음성 선택", callback_data: "tts:voices" },
          ],
          [
            { text: "📚 변환 기록", callback_data: "tts:history" },
            { text: "⚙️ 설정", callback_data: "tts:settings" },
          ],
          [
            { text: "❓ 도움말", callback_data: "tts:help" },
            { text: "🔙 메인 메뉴", callback_data: "system:menu" },
          ],
        ];
        break;

      // TTS 텍스트 입력 요청
      case "tts:input":
        text =
          result.message ||
          `📝 **텍스트 입력**\n\n변환할 텍스트를 입력하세요\\.\n\n최대 5000자까지 입력 가능합니다\\.`;

        keyboard.inline_keyboard = [
          [
            { text: "🔙 메뉴로", callback_data: "tts:menu" },
            { text: "🏠 메인", callback_data: "system:menu" },
          ],
        ];
        break;

      // TTS 음성 목록
      case "tts:list":
        const listData = result.data;
        text = `🎭 **${listData?.title || "음성 목록"}**\n\n`;

        if (listData?.items && listData.items.length > 0) {
          listData.items.forEach((item, index) => {
            text += `${index + 1}\\. **${this.escapeMarkdownV2(
              item.title
            )}**\n`;
            if (item.description) {
              text += `   ${this.escapeMarkdownV2(item.description)}\n`;
            }
            text += `\n`;
          });
        } else {
          text += `목록이 비어있습니다\\.`;
        }

        keyboard.inline_keyboard = [
          [
            { text: "🔙 메뉴로", callback_data: "tts:menu" },
            { text: "🏠 메인", callback_data: "system:menu" },
          ],
        ];
        break;

      // TTS 설정
      case "tts:settings":
        const settingsData = result.data;
        text = `⚙️ **${settingsData?.title || "TTS 설정"}**\n\n`;

        if (settingsData?.settings) {
          settingsData.settings.forEach((setting) => {
            text += `**${this.escapeMarkdownV2(setting.label)}**: `;
            if (setting.type === "boolean") {
              text += setting.value ? "✅ 활성" : "❌ 비활성";
            } else {
              text += this.escapeMarkdownV2(String(setting.value));
            }
            text += `\n`;
          });
        }

        keyboard.inline_keyboard = [
          [
            { text: "🔧 설정 변경", callback_data: "tts:settings:edit" },
            { text: "🔄 초기화", callback_data: "tts:settings:reset" },
          ],
          [
            { text: "🔙 메뉴로", callback_data: "tts:menu" },
            { text: "🏠 메인", callback_data: "system:menu" },
          ],
        ];
        break;

      // TTS 도움말
      case "tts:help":
        const helpData = result.data;
        text = `❓ **${helpData?.title || "TTS 도움말"}**\n\n`;

        if (helpData?.features) {
          text += `**🎯 주요 기능**\n`;
          helpData.features.forEach((feature) => {
            text += `• ${this.escapeMarkdownV2(feature)}\n`;
          });
          text += `\n`;
        }

        if (helpData?.commands) {
          text += `**⌨️ 사용법**\n`;
          helpData.commands.forEach((command) => {
            text += `• ${this.escapeMarkdownV2(command)}\n`;
          });
          text += `\n`;
        }

        if (helpData?.tips) {
          text += `**💡 팁**\n`;
          helpData.tips.forEach((tip) => {
            text += `• ${this.escapeMarkdownV2(tip)}\n`;
          });
        }

        keyboard.inline_keyboard = [
          [
            { text: "🔊 TTS 메뉴", callback_data: "tts:menu" },
            { text: "🏠 메인", callback_data: "system:menu" },
          ],
        ];
        break;

      // TTS 빈 목록
      case "tts:empty":
        text =
          result.message ||
          `📭 **목록이 비어있습니다**\n\n아직 변환 기록이 없습니다\\.\n\n새로운 텍스트를 변환해보세요\\!`;

        keyboard.inline_keyboard = [
          [
            { text: "🎤 텍스트 변환", callback_data: "tts:convert" },
            { text: "🔙 메뉴로", callback_data: "tts:menu" },
          ],
        ];
        break;
      // 다른 케이스 추가
      default:
        text += `작업 *${this.escapeMarkdownV2(
          result.type
        )}* 이\\(가\\) 완료되었습니다.`;
        break;
    }
    // --- ⬆️ 여기까지가 핵심입니다 ⬆️ ---

    keyboard.inline_keyboard.push([
      { text: "🏠 메인 메뉴", callback_data: "system:menu" },
    ]);

    try {
      await ctx.telegram.editMessageText(chatId, messageId, undefined, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      if (!error.message.includes("message is not modified")) {
        logger.error("RenderResponse 수정 실패:", error);
        await this.showNavigationError(ctx, error);
      }
    }
  }

  async showMainMenu(ctx) {
    const userName = getUserName(ctx.from);
    const chatId = ctx.chat?.id || ctx.from.id;

    const menuText = `🤖 *두목봇 3\\.0\\.1*

안녕하세요 ${this.escapeMarkdownV2(userName)}님\\! 👋

무엇을 도와드릴까요\\?

모듈을 선택하세요\\:`;

    const enabledModules = getEnabledModules();
    const keyboard = { inline_keyboard: [] };

    // 모듈 버튼 생성 (2열씩)
    for (let i = 0; i < enabledModules.length; i += 2) {
      const row = [];

      // 첫 번째 모듈
      const module1 = enabledModules[i];
      const icon1 = this.getModuleIcon(module1.key);
      const name1 = this.getModuleName(module1.key);

      row.push({
        text: `${icon1} ${name1}`,
        callback_data: `${module1.key}:menu`,
      });

      // 두 번째 모듈 (있으면)
      if (i + 1 < enabledModules.length) {
        const module2 = enabledModules[i + 1];
        const icon2 = this.getModuleIcon(module2.key);
        const name2 = this.getModuleName(module2.key);

        row.push({
          text: `${icon2} ${name2}`,
          callback_data: `${module2.key}:menu`,
        });
      }

      keyboard.inline_keyboard.push(row);
    }

    // 하단 시스템 버튼들
    keyboard.inline_keyboard.push([
      { text: "❓ 도움말", callback_data: "system:help" },
      { text: "ℹ️ 정보", callback_data: "system:info" },
      { text: "📊 상태", callback_data: "system:status" },
    ]);

    try {
      if (ctx.callbackQuery) {
        await ctx.editMessageText(menuText, {
          parse_mode: "MarkdownV2",
          reply_markup: keyboard,
        });
      } else {
        await ctx.reply(menuText, {
          parse_mode: "MarkdownV2",
          reply_markup: keyboard,
        });
      }
    } catch (error) {
      logger.error("메인 메뉴 표시 오류:", error);
      await ctx.reply("메뉴를 표시하는 중 오류가 발생했습니다.");
    }
  }

  // 모듈 아이콘 가져오기
  getModuleIcon(moduleKey) {
    const icons = {
      system: "⚙️",
      todo: "📋",
      timer: "⏰",
      worktime: "🏢",
      leave: "🏖️",
      reminder: "🔔",
      fortune: "🔮",
      weather: "🌤️",
      tts: "🔊",
    };
    return icons[moduleKey] || "📱";
  }

  // 모듈 이름 가져오기
  getModuleName(moduleKey) {
    const names = {
      system: "시스템",
      todo: "할일 관리",
      timer: "타이머",
      worktime: "근무시간 관리",
      leave: "휴가 관리",
      reminder: "리마인더",
      fortune: "운세",
      weather: "날씨",
      tts: "음성 변환",
    };
    return names[moduleKey] || moduleKey;
  }

  async showNavigationError(ctx, error) {
    const errorText = `🚨 오류 발생\n\n요청 처리 중 문제가 발생했습니다.\n메인 메뉴로 돌아가 다시 시도해 주세요.`;
    const keyboard = {
      inline_keyboard: [
        [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
      ],
    };
    try {
      if (ctx.callbackQuery) {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          ctx.callbackQuery.message.message_id,
          undefined,
          errorText,
          { reply_markup: keyboard }
        );
      } else {
        await ctx.reply(errorText, { reply_markup: keyboard });
      }
    } catch (sendError) {
      logger.error("최종 오류 메시지 전송 실패:", sendError);
    }
  }
}

module.exports = NavigationHandler;
