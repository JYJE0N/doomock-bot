// src/utils/TTSStateHelper.js
// const logger = require("./core/Logger");

class TTSStateHelper {
  constructor() {
    this.userStates = new Map();
    this.stateTimeout = 5 * 60 * 1000; // 5분
  }

  setState(userId, state) {
    this.userStates.set(userId, {
      ...state,
      timestamp: Date.now()
    });

    // 자동 정리
    setTimeout(() => {
      this.clearState(userId);
    }, this.stateTimeout);
  }

  getState(userId) {
    const state = this.userStates.get(userId);
    if (!state) return null;

    // 타임아웃 체크
    if (Date.now() - state.timestamp > this.stateTimeout) {
      this.clearState(userId);
      return null;
    }

    return state;
  }

  clearState(userId) {
    this.userStates.delete(userId);
  }

  isWaitingForInput(userId) {
    const state = this.getState(userId);
    return state?.action === "waiting_text_input";
  }
}

module.exports = TTSStateHelper;
