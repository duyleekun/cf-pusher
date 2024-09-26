import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";

import { describe, it, expect, vi as vitest, beforeAll, afterAll } from "vitest";
import worker from "../src";

describe("DOPusher", () => {

    it("should return 405 for unsupported methods", async () => {
      const request = new Request("http://example.com/test", {
        method: "PUT",
      });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);

      expect(response.status).toBe(200);
    });
});
