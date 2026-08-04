import assert from "node:assert/strict";
import test from "node:test";
import { createInfrai } from "../src/infrai.ts";

test("retries a throttled event request using Retry-After", async () => {
  process.env.INFRAI_API_KEY = "test-key";
  const requests: Array<{ input: string; init?: RequestInit }> = [];
  const delays: number[] = [];
  const responses = [
    new Response(JSON.stringify({ ok: false, data: null, error: { message: "retry" } }), {
      status: 429,
      headers: { "Retry-After": "2" },
    }),
    new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }),
  ];
  const client = createInfrai({
    fetch: async (input, init) => {
      requests.push({ input: String(input), init });
      return responses.shift() as Response;
    },
    sleep: async (milliseconds) => {
      delays.push(milliseconds);
    },
  });

  const events = await client.email.event.list("msg 42");

  assert.deepEqual(events, []);
  assert.deepEqual(delays, [2_000]);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].init?.method, "GET");
  assert.match(requests[0].input, /message_id=msg%2042$/);
});

test("surfaces an API envelope error", async () => {
  process.env.INFRAI_API_KEY = "test-key";
  const client = createInfrai({
    fetch: async () =>
      new Response(JSON.stringify({ ok: false, data: null, error: { message: "request rejected" } }), {
        status: 400,
      }),
  });

  await assert.rejects(() => client.email.event.list("msg-1"), /request rejected/);
});
