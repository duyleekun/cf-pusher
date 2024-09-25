import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect, vi as vitest, beforeAll, afterAll } from "vitest";
import { DOPusher } from "../src/DOPusher";
import { unstable_dev } from "wrangler";

describe("DOPusher", () => {
  let worker;

  beforeAll(async () => {
    worker = await unstable_dev("src/index.ts", {
      experimental: { disableExperimentalWarning: true },
    });
  });

  afterAll(async () => {
    await worker.stop();
  });
  it("should handle WebSocket connection and message", async () => {
    const request = new Request("http://example.com");
    const response = await worker.fetch(request);

    expect(response.status).toBe(101);

    const ws = {
      send: vitest.fn().mockImplementation((message) => {
        const parsedMessage = JSON.parse(message);
        if (parsedMessage.event === 'pusher_internal:subscription_succeeded') {
          expect(parsedMessage.channel).toBe('test-channel');
        }
      }),
      close: vitest.fn(),
      serializeAttachment: vitest.fn(),
      deserializeAttachment: () => ({ subscriptions: new Set() }),
    };

    await dopusher.webSocketMessage(ws, JSON.stringify({
      event: "pusher:subscribe",
      data: { channel: "test-channel" },
    }));

    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({
      event: "pusher_internal:subscription_succeeded",
      channel: "test-channel",
    }));
    expect(ws.send).toHaveBeenCalledTimes(1);
  });

  describe("fetch method", () => {
    it("should handle POST request and store text", async () => {
      const request = new Request("http://example.com/test", {
        method: "POST",
        body: "Hello World",
      });
      const response = await worker.fetch(request);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("The text was consumed!");
      expect(state.storage.put).toHaveBeenCalledWith("/test", "Hello World");
    });

    it("should handle GET request and retrieve stored text", async () => {
      const request = new Request("http://example.com/test", {
        method: "GET",
      });
      const response = await worker.fetch(request);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("Hello World");
    });

    it("should return 404 for GET request if no text is found", async () => {
      const request = new Request("http://example.com/test", {
        method: "GET",
      });
      const response = await worker.fetch(request);

      expect(response.status).toBe(404);
      expect(await response.text()).toBe("No text found");
    });

    it("should return 405 for unsupported methods", async () => {
      const request = new Request("http://example.com/test", {
        method: "PUT",
      });
      const response = await worker.fetch(request);

      expect(response.status).toBe(405);
      expect(await response.text()).toBe("Method not allowed");
    });
  });
});
