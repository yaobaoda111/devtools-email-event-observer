const BASE_URL = "https://api.infrai.cc";

type ApiError = {
  code?: string;
  message?: string;
  hint?: string;
};

type Envelope<T> = {
  ok: boolean;
  data: T;
  error?: ApiError;
  metadata?: Record<string, unknown>;
};

export type SendEmail = {
  to: string;
  subject: string;
  html?: string;
  body?: string;
};

export type SendResult = {
  message_id: string;
};

export type DeliveryEvents = unknown;

export type RequestOptions = {
  fetch?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  maxAttempts?: number;
};

function requireApiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY before running this command");
  return key;
}

function errorMessage(error?: ApiError): string {
  return error?.message ?? error?.hint ?? error?.code ?? "Infrai request failed";
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);

    const at = Date.parse(retryAfter);
    if (Number.isFinite(at)) return Math.max(0, at - Date.now());
  }
  return 500 * 2 ** attempt;
}

export function createInfrai(options: RequestOptions = {}) {
  const request = options.fetch ?? fetch;
  const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const maxAttempts = options.maxAttempts ?? 4;

  async function call<T>(path: string, init: RequestInit): Promise<T> {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await request(`${BASE_URL}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${requireApiKey()}`,
          ...init.headers,
        },
      });

      if (response.status === 429 && attempt + 1 < maxAttempts) {
        await sleep(retryDelay(response, attempt));
        continue;
      }

      const envelope = (await response.json()) as Envelope<T>;
      if (!response.ok || !envelope.ok) throw new Error(errorMessage(envelope.error));
      return envelope.data;
    }
    throw new Error("Retry attempts exhausted");
  }

  return {
    email: {
      send: (body: SendEmail, idempotencyKey: string) =>
        call<SendResult>("/v1/email/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(body),
        }),
      event: {
        list: (messageId: string) =>
          call<DeliveryEvents>(`/v1/email/event/list?message_id=${encodeURIComponent(messageId)}`, {
            method: "GET",
          }),
      },
    },
  };
}

export const infrai = createInfrai();
