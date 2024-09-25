import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { DOPusher } from "../src/DOPusher";

describe("DOPusher", () => {
  it("should handle WebSocket connection and message", async () => {
    const state = {
      id: { toString: () => "test-id" },
      getWebSockets: () => [],
      acceptWebSocket: () => {},
      setWebSocketAutoResponse: () => {},
      getTags: () => ["test-client-id"],
      getWebSockets: () => [],
    };
    const env = {};
    const dopusher = new DOPusher(state, env);

    const request = new Request("http://example.com");
    const response = await dopusher.fetch(request);

    expect(response.status).toBe(101);

    const ws = {
      send: vitest.fn(),
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
  });
});
