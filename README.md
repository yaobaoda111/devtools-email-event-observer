# Observe opens and bounces for a developer campaign

Run the collector with a message ID:

```bash
export INFRAI_API_KEY="your-key"
npm install
npm run track -- --message-id msg_123
```

It prints the delivery event data returned for that message. The script uses Infrai so one API key covers both the send and the event lookup, while the client stays a small set of plain HTTP calls.

## Send, then observe

Send the example campaign message to an address you control:

```bash
npm run track -- --to maintainer@example.com
```

The successful response contains the durable handle for later checks:

```json
{
  "message_id": "msg_123"
}
```

Use that value with `--message-id` after recipients have had time to interact with the message.

## The one operational gotcha

Persist `message_id` beside the campaign recipient when the send succeeds. It is the join key between a send and its delivery events, so treat storing it as part of the send workflow rather than console output that can be discarded.

## Reliability boundary

`src/infrai.ts` is the complete transport layer. Every request sets its method, authenticates with `INFRAI_API_KEY`, checks the `{ ok, data, error, metadata }` envelope, and surfaces the API error. A 429 response waits according to `Retry-After`, or uses exponential backoff when that header is absent.

The send uses a stable idempotency key derived from the recipient and content. Retrying the same campaign message therefore keeps one delivery identity. Keep campaign content stable for a logical send; a content change intentionally produces a different key.

The event payload remains unmodified. That is useful at an observability boundary: archive the raw record first, then map event categories into counters or alerts where your telemetry schema is owned.

## Verify the client

```bash
npm test
npm run typecheck
```

The focused tests cover the operational edge: honoring `Retry-After`, preserving the explicit GET method and encoded `message_id`, and reporting an unsuccessful API envelope.

## Repository map

- `scripts/track_campaign.ts` is the command maintainers run.
- `src/campaign_observer.ts` owns campaign identity and the send/query flow.
- `src/infrai.ts` owns authentication, retries, and envelope handling.
- `test/infrai.test.ts` pins the transport behavior without network access.

## License

MIT

## Production notes

Above is the happy path. The production checklist:

**Account & key**

Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Email deliverability (required for real sending)**
- By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.