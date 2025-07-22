// src/utils/ResponseHelper.js - 표준 응답 헬퍼 (새로 생성)

class ResponseHelper {
  /**
   * 성공 응답 생성
   * @param {any} data - 응답 데이터
   * @param {string} message - 성공 메시지 (선택적)
   * @returns {object} 표준 성공 응답
   */
  static success(data = null, message = null) {
    const response = {
      success: true,
    };

    if (data !== null) {
      response.data = data;
    }

    if (message) {
      response.message = message;
    }

    return response;
  }

  /**
   * 실패 응답 생성
   * @param {string} error - 에러 메시지
   * @param {any} data - 추가 데이터 (선택적)
   * @returns {object} 표준 실패 응답
   */
  static error(error, data = null) {
    const response = {
      success: false,
      error: error,
    };

    if (data !== null) {
      response.data = data;
    }

    return response;
  }

  /**
   * 데이터와 함께 성공 응답
   * @param {any} data - 응답 데이터
   * @param {object} meta - 메타 정보 (총 개수, 페이지 등)
   * @returns {object} 데이터가 포함된 성공 응답
   */
  static successWithData(data, meta = {}) {
    return {
      success: true,
      data: data,
      ...meta,
    };
  }

  /**
   * 검증 실패 응답
   * @param {string} field - 실패한 필드명
   * @param {string} message - 검증 실패 메시지
   * @returns {object} 검증 실패 응답
   */
  static validationError(field, message) {
    return {
      success: false,
      error: message,
      field: field,
      type: "validation",
    };
  }

  /**
   * 권한 없음 응답
   * @param {string} message - 권한 관련 메시지
   * @returns {object} 권한 없음 응답
   */
  static unauthorized(message = "권한이 없습니다.") {
    return {
      success: false,
      error: message,
      type: "unauthorized",
    };
  }

  /**
   * 리소스 없음 응답
   * @param {string} resource - 찾을 수 없는 리소스명
   * @returns {object} 리소스 없음 응답
   */
  static notFound(resource = "데이터") {
    return {
      success: false,
      error: `${resource}를 찾을 수 없습니다.`,
      type: "not_found",
    };
  }

  /**
   * 서버 에러 응답
   * @param {string} message - 에러 메시지
   * @returns {object} 서버 에러 응답
   */
  static serverError(message = "서버 오류가 발생했습니다.") {
    return {
      success: false,
      error: message,
      type: "server_error",
    };
  }
}

module.exports = ResponseHelper;
