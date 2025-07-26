// src/modules/ExampleModule.js - 표준 모듈 템플릿
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const formatter = require("../utils/MessageFormatter");
const { getUserName, getUserId } = require("../utils/UserHelper");

/**
 * 📱 ExampleModule - 표준 모듈 템플릿
 *
 * 🎯 구현 순서:
 * 1. UI/메뉴 먼저 완성 (껍데기)
 * 2. 네비게이션 흐름 확인
 * 3. 서비스 연결
 * 4. 비즈니스 로직 구현
 */
class ExampleModule extends BaseModule {
  constructor(bot, options = {}) {
    super("ExampleModule", {
      bot,
      moduleManager: options.moduleManager,
      config: options.config,
    });

    // 모듈 설정
    this.config = {
      enabled: true,
      version: "1.0.0",
      ...options.config,
    };

    // 서비스 (나중에 연결)
    this.exampleService = null;

    logger.module("ExampleModule", "🚀 모듈 생성됨", {
      version: this.config.version,
      enabled: this.config.enabled,
    });
  }

  /**
   * 🎯 모듈 초기화
   */
  async onInitialize() {
    try {
      logger.module("ExampleModule", "📦 초기화 시작...");

      // TODO: 서비스 초기화
      // this.exampleService = new ExampleService();
      // await this.exampleService.initialize();

      logger.success("✅ ExampleModule 초기화 완료");
    } catch (error) {
      logger.error("❌ ExampleModule 초기화 실패", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록
   */
  setupActions() {
    logger.debug("🎯 ExampleModule 액션 등록");

    this.registerActions({
      // 메인 메뉴
      menu: this.showMenu,

      // 목록 관련
      list: this.showList,
      add: this.showAddMenu,
      edit: this.showEditMenu,
      delete: this.showDeleteConfirm,

      // 상세/검색
      detail: this.showDetail,
      search: this.showSearchMenu,

      // 설정/도움말
      settings: this.showSettings,
      help: this.showHelp,

      // 페이지네이션
      page: this.handlePagination,
    });

    logger.module(
      "ExampleModule",
      `✅ ${this.actionMap.size}개 액션 등록 완료`
    );
  }

  // ===== 🎨 UI 메서드들 (껍데기 먼저 구현) =====

  /**
   * 📱 메인 메뉴
   */
  async showMenu(bot, callbackQuery, params, moduleManager) {
    logger.navigation("user", "example:menu");

    const userName = getUserName(callbackQuery);

    // 임시 데이터 (나중에 서비스에서 가져옴)
    const stats = {
      total: 42,
      active: 15,
      completed: 27,
    };

    // 메뉴 텍스트 생성
    const menuText = [
      formatter.title("예시 모듈", "📱"),
      "",
      `안녕하세요, ${formatter.highlight(userName)}님!`,
      "",
      formatter.section("현재 상태", "📊"),
      formatter.keyValue("전체 항목", `${stats.total}개`, "📋"),
      formatter.keyValue("활성 항목", `${stats.active}개`, "🟢"),
      formatter.keyValue("완료됨", `${stats.completed}개`, "✅"),
      "",
      formatter.progressBar(stats.completed, stats.total),
      "",
      formatter.section("메뉴", "🎯"),
      "원하는 기능을 선택해주세요.",
    ].join("\n");

    // NavigationHandler가 처리하도록 데이터 반환
    return {
      success: true,
      action: "render_module_menu",
      data: {
        text: menuText,
        module: "example",
        stats: stats,
      },
    };
  }

  /**
   * 📋 목록 보기
   */
  async showList(bot, callbackQuery, params, moduleManager) {
    logger.navigation("example:menu", "example:list");

    const page = parseInt(params[0]) || 1;

    // 임시 데이터
    const items = [
      { id: 1, title: "첫 번째 항목", status: "active" },
      { id: 2, title: "두 번째 항목", status: "completed" },
      { id: 3, title: "세 번째 항목", status: "active" },
    ];

    const listText = [
      formatter.title("항목 목록", "📋"),
      "",
      formatter.keyValue("전체", `${items.length}개`, "📊"),
      formatter.keyValue("페이지", `${page}/1`, "📄"),
      "",
      formatter.section("목록", "📝"),
    ];

    // 항목 표시
    items.forEach((item, idx) => {
      const icon = item.status === "completed" ? "✅" : "🔵";
      listText.push(`${icon} ${formatter.escape(item.title)}`);
    });

    listText.push("", formatter.section("옵션", "⚙️"));

    return {
      success: true,
      action: "render_list",
      data: {
        text: listText.join("\n"),
        module: "example",
        items: items,
        page: page,
      },
    };
  }

  /**
   * ➕ 추가 메뉴
   */
  async showAddMenu(bot, callbackQuery, params, moduleManager) {
    logger.navigation("example:menu", "example:add");

    const addText = [
      formatter.title("새 항목 추가", "➕"),
      "",
      formatter.section("안내", "ℹ️"),
      "추가할 항목의 정보를 입력해주세요.",
      "",
      formatter.warning("텍스트로 입력해주세요."),
      "",
      '예시: "오늘 할 일 추가"',
    ].join("\n");

    // 사용자 상태 설정 (입력 대기)
    this.setUserState(getUserId(callbackQuery), {
      action: "waiting_add_input",
      timestamp: Date.now(),
    });

    return {
      success: true,
      action: "render_input_prompt",
      data: {
        text: addText,
        module: "example",
        inputType: "add",
      },
    };
  }

  /**
   * 🗑️ 삭제 확인
   */
  async showDeleteConfirm(bot, callbackQuery, params, moduleManager) {
    const itemId = params[0];
    logger.navigation("example:list", `example:delete:${itemId}`);

    const deleteText = [
      formatter.title("삭제 확인", "🗑️"),
      "",
      formatter.error("정말로 이 항목을 삭제하시겠습니까?"),
      "",
      formatter.section("항목 정보", "📄"),
      formatter.keyValue("ID", itemId),
      formatter.keyValue("제목", "예시 항목"),
      "",
      formatter.warning("이 작업은 되돌릴 수 없습니다!"),
    ].join("\n");

    return {
      success: true,
      action: "render_confirm",
      data: {
        text: deleteText,
        module: "example",
        confirmType: "delete",
        itemId: itemId,
      },
    };
  }

  /**
   * ⚙️ 설정
   */
  async showSettings(bot, callbackQuery, params, moduleManager) {
    logger.navigation("example:menu", "example:settings");

    const settingsText = [
      formatter.title("설정", "⚙️"),
      "",
      formatter.section("현재 설정", "🔧"),
      formatter.keyValue("알림", "활성화 ✅"),
      formatter.keyValue("자동 저장", "활성화 ✅"),
      formatter.keyValue("표시 개수", "10개"),
      "",
      formatter.section("옵션", "🎛️"),
      "변경하고 싶은 설정을 선택하세요.",
    ].join("\n");

    return {
      success: true,
      action: "render_settings",
      data: {
        text: settingsText,
        module: "example",
      },
    };
  }

  /**
   * ❓ 도움말
   */
  async showHelp(bot, callbackQuery, params, moduleManager) {
    logger.navigation("example:menu", "example:help");

    const helpText = [
      formatter.title("도움말", "❓"),
      "",
      formatter.section("주요 기능", "🎯"),
      formatter.listItem("항목 추가 - 새로운 항목을 등록합니다"),
      formatter.listItem("목록 보기 - 전체 항목을 확인합니다"),
      formatter.listItem("검색 - 특정 항목을 찾습니다"),
      "",
      formatter.section("사용 방법", "📖"),
      formatter.arrowItem("메뉴에서 원하는 기능 선택"),
      formatter.arrowItem("안내에 따라 정보 입력"),
      formatter.arrowItem("완료 후 확인"),
      "",
      formatter.section("팁", "💡"),
      formatter.quote("키보드 버튼을 활용하면 더 편리합니다!", "도움말 도우미"),
    ].join("\n");

    return {
      success: true,
      action: "render_help",
      data: {
        text: helpText,
        module: "example",
      },
    };
  }

  /**
   * 📄 상세 보기
   */
  async showDetail(bot, callbackQuery, params, moduleManager) {
    const itemId = params[0];
    logger.navigation("example:list", `example:detail:${itemId}`);

    // 임시 데이터
    const item = {
      id: itemId,
      title: "예시 항목",
      description: "이것은 예시 항목입니다.",
      status: "active",
      created: "2024-03-15",
      updated: "2024-03-16",
    };

    const detailText = [
      formatter.title("상세 정보", "📄"),
      "",
      formatter.box(
        [
          formatter.keyValue("제목", item.title),
          formatter.keyValue("상태", formatter.badge(item.status, "active")),
          formatter.keyValue("생성일", item.created),
          formatter.keyValue("수정일", item.updated),
        ].join("\n"),
        "INFO"
      ),
      "",
      formatter.section("설명", "📝"),
      item.description,
      "",
      formatter.section("옵션", "⚙️"),
    ].join("\n");

    return {
      success: true,
      action: "render_detail",
      data: {
        text: detailText,
        module: "example",
        item: item,
      },
    };
  }

  /**
   * 🔍 검색 메뉴
   */
  async showSearchMenu(bot, callbackQuery, params, moduleManager) {
    logger.navigation("example:menu", "example:search");

    const searchText = [
      formatter.title("검색", "🔍"),
      "",
      formatter.section("검색 안내", "ℹ️"),
      "찾고 싶은 항목의 키워드를 입력하세요.",
      "",
      "예시:",
      formatter.listItem('"프로젝트" - 프로젝트 관련 항목'),
      formatter.listItem('"완료" - 완료된 항목'),
      formatter.listItem('"오늘" - 오늘 추가된 항목'),
      "",
      formatter.highlight("검색어를 입력해주세요."),
    ].join("\n");

    // 검색 입력 대기 상태
    this.setUserState(getUserId(callbackQuery), {
      action: "waiting_search_input",
      timestamp: Date.now(),
    });

    return {
      success: true,
      action: "render_search",
      data: {
        text: searchText,
        module: "example",
      },
    };
  }

  /**
   * 📄 페이지네이션 처리
   */
  async handlePagination(bot, callbackQuery, params, moduleManager) {
    const page = parseInt(params[0]) || 1;
    logger.navigation(`example:list:${page - 1}`, `example:list:${page}`);

    // 목록 다시 표시
    return this.showList(bot, callbackQuery, [page], moduleManager);
  }

  // ===== 🎮 메시지 처리 =====

  /**
   * 메시지 처리
   */
  async onHandleMessage(bot, msg) {
    const userId = getUserId(msg);
    const userState = this.getUserState(userId);

    if (!userState) return false;

    // 입력 대기 상태 처리
    switch (userState.action) {
      case "waiting_add_input":
        return await this.handleAddInput(bot, msg);

      case "waiting_search_input":
        return await this.handleSearchInput(bot, msg);

      default:
        return false;
    }
  }

  /**
   * 추가 입력 처리
   */
  async handleAddInput(bot, msg) {
    const userId = getUserId(msg);
    const text = msg.text;

    logger.module("ExampleModule", "➕ 추가 입력 받음", { userId, text });

    // TODO: 실제 저장 로직

    const successText = [
      formatter.success("항목이 추가되었습니다!"),
      "",
      formatter.keyValue("제목", text),
    ].join("\n");

    await bot.sendMessage(msg.chat.id, successText, {
      parse_mode: "MarkdownV2",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📋 목록 보기", callback_data: "example:list" },
            { text: "➕ 추가하기", callback_data: "example:add" },
          ],
        ],
      },
    });

    // 상태 초기화
    this.clearUserState(userId);
    return true;
  }

  /**
   * 검색 입력 처리
   */
  async handleSearchInput(bot, msg) {
    const userId = getUserId(msg);
    const query = msg.text;

    logger.module("ExampleModule", "🔍 검색어 입력 받음", { userId, query });

    // TODO: 실제 검색 로직

    const resultText = [
      formatter.title("검색 결과", "🔍"),
      "",
      formatter.keyValue("검색어", query),
      formatter.keyValue("결과", "3개"),
      "",
      "🔵 첫 번째 검색 결과",
      "🔵 두 번째 검색 결과",
      "🔵 세 번째 검색 결과",
    ].join("\n");

    await bot.sendMessage(msg.chat.id, resultText, {
      parse_mode: "MarkdownV2",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔍 다시 검색", callback_data: "example:search" },
            { text: "📋 전체 목록", callback_data: "example:list" },
          ],
        ],
      },
    });

    // 상태 초기화
    this.clearUserState(userId);
    return true;
  }

  /**
   * 📊 모듈 상태
   */
  getStatus() {
    return {
      name: this.moduleName,
      version: this.config.version,
      enabled: this.config.enabled,
      initialized: this.isInitialized,
      actions: Array.from(this.actionMap.keys()),
      activeUsers: this.userStates.size,
    };
  }
}

module.exports = ExampleModule;
