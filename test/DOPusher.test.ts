import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { DOPusher } from "../src/DOPusher";

describe("DOPusher", () => {
  it("should handle WebSocket connection and message", async () => {
    const state = {
      id: { toString: () => "test-id" },
      getWebSockets: vitest.fn().mockReturnValue([]),
      acceptWebSocket: vitest.fn(),
      setWebSocketAutoResponse: vitest.fn(),
      getTags: vitest.fn().mockReturnValue(["test-client-id"]),
    };
    const env = {};
    const dopusher = new DOPusher(state, env);

    const request = new Request("http://example.com");
    const response = await dopusher.fetch(request);

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
});
