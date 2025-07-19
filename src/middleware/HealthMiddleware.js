// src/middleware/HealthMiddleware.js - HTTP 엔드포인트 처리
const HealthService = require("../services/HealthService");
const Logger = require("../utils/Logger");

class HealthMiddleware {
  constructor() {
    this.healthService = new HealthService();
  }

  /**
   * Railway용 HTTP 핸들러 생성
   */
  createHandler() {
    return async (req, res) => {
      try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const path = url.pathname;
        const query = url.searchParams;

        // CORS 헤더 설정
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.setHeader("Content-Type", "application/json");

        // OPTIONS 요청 처리
        if (req.method === "OPTIONS") {
          res.writeHead(200);
          res.end();
          return;
        }

        // GET 요청만 허용
        if (req.method !== "GET") {
          res.writeHead(405, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Method Not Allowed" }));
          return;
        }

        let result;
        let statusCode = 200;

        switch (path) {
          case "/health":
          case "/":
            // 기본 헬스체크
            if (query.get("quick") === "true") {
              result = this.healthService.getQuickHealth();
            } else {
              result = await this.healthService.getSystemHealth();

              // 상태에 따른 HTTP 상태 코드 설정
              if (result.status === "degraded") {
                statusCode = 503; // Service Unavailable
              } else if (result.status === "error") {
                statusCode = 500; // Internal Server Error
              }
            }
            break;

          case "/health/history":
            // 헬스체크 히스토리
            result = this.healthService.getHealthHistory();
            break;

          case "/health/quick":
            // 빠른 상태 확인
            result = this.healthService.getQuickHealth();
            break;

          case "/ping":
            // 단순 ping 응답
            result = {
              status: "pong",
              timestamp: new Date().toISOString(),
              uptime: Math.round(process.uptime()),
            };
            break;

          default:
            // 404 처리
            statusCode = 404;
            result = {
              error: "Not Found",
              availableEndpoints: [
                "/health",
                "/health/quick",
                "/health/history",
                "/ping",
              ],
            };
        }

        // 응답 전송
        res.writeHead(statusCode, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result, null, 2));

        // 로깅 (에러가 아닌 경우만)
        if (statusCode < 400) {
          Logger.debug(`헬스체크 요청: ${path} - ${result.status || "ok"}`);
        }
      } catch (error) {
        Logger.error("헬스체크 핸들러 오류:", error);

        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: "error",
            timestamp: new Date().toISOString(),
            error: error.message,
          }),
        );
      }
    };
  }

  /**
   * Express 스타일 미들웨어 (필요시)
   */
  createExpressMiddleware() {
    return async (req, res, next) => {
      if (req.path.startsWith("/health")) {
        const handler = this.createHandler();
        return handler(req, res);
      }
      next();
    };
  }
}

module.exports = HealthMiddleware;
