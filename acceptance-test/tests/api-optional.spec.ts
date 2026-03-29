import { expect, test } from "@playwright/test";
import { BACKEND_HEALTH_URL } from "./constants";

/**
 * Varsayılan: atlanır (backend yok, ECONNREFUSED önlenir).
 * Gerçekten çalıştırmak için: RUN_BACKEND_API_TESTS=1 npx playwright test
 */
const runBackendApi = process.env.RUN_BACKEND_API_TESTS === "1";

test.describe("Backend (isteğe bağlı)", () => {
  test.beforeEach(({ }, testInfo) => {
    testInfo.skip(!runBackendApi, "RUN_BACKEND_API_TESTS=1 ile aç");
  });

  test("GET /health 200", async ({ request }) => {
    const res = await request.get(BACKEND_HEALTH_URL);
    expect(
      res.status(),
      `Backend kapalı veya ${BACKEND_HEALTH_URL} yanlış.`,
    ).toBe(200);
  });

  test("GET /docs veya OpenAPI yanıtı", async ({ request }) => {
    const base = BACKEND_HEALTH_URL.replace(/\/health\/?$/, "");
    const res = await request.get(`${base}/docs`);
    expect([200, 307, 308]).toContain(res.status());
  });
});
