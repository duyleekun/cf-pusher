import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect, vi as vitest } from "vitest";
import { DOPusher } from "../src/DOPusher";

describe("DOPusher", () => {
  it("should handle WebSocket connection and message", async () => {
    const state = {
      id: { toString: () => "test-id" },
      getWebSockets: vitest.fn().mockReturnValue([]),
      acceptWebSocket: vitest.fn(),
      setWebSocketAutoResponse: vitest.fn(),
      getTags: vitest.fn().mockReturnValue(["test-client-id"]),
      storage: {
        get: vitest.fn(),
        put: vitest.fn(),
        delete: vitest.fn(),
        list: vitest.fn(),
      },
      blockConcurrencyWhile: vitest.fn(),
      waitUntil: vitest.fn(),
      fetch: vitest.fn(),
      // Add the following properties to correctly mock DurableObjectState
      get: vitest.fn(),
      put: vitest.fn(),
      delete: vitest.fn(),
      list: vitest.fn(),
      transaction: vitest.fn(),
      sync: vitest.fn(),
      getAlarm: vitest.fn(),
      setAlarm: vitest.fn(),
      deleteAlarm: vitest.fn(),
      fetch: vitest.fn(),
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
