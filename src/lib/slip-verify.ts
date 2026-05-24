/**
 * Slip verification — pluggable provider.
 *
 * Production providers we can swap in by setting SLIP_VERIFY_PROVIDER:
 *  - "slipok"   → calls https://api.slipok.com/api/line/apikey/{branchId}
 *  - "easyslip" → calls https://developer.easyslip.com/api/v1/verify
 *  - "mock"     → returns a deterministic fake result. Used until the team adds keys.
 *
 * The verify result shape is normalized across providers so the rest of the
 * code (and the future React Native app) only ever sees one type.
 */
export type SlipProvider = "slipok" | "easyslip" | "mock";

export interface SlipVerifyInput {
  /** Base64-encoded slip image, or `qrPayload` from a scanned QR. Exactly one required. */
  imageBase64?: string;
  qrPayload?: string;
  /** Expected amount in THB to cross-check against the slip. */
  expectAmount?: number;
  /** Expected receiver PromptPay ID. */
  expectReceiverId?: string;
}

export interface SlipVerifyResult {
  /** True if the slip was successfully parsed and verified. */
  verified: boolean;
  /** Transaction reference / bank transaction ID. */
  ref?: string;
  /** Amount in THB the slip claims. */
  amount?: number;
  /** ISO timestamp of the transfer. */
  transferredAt?: string;
  /** Sender info as parsed. */
  sender?: { name?: string; bank?: string; account?: string };
  /** Receiver info as parsed. */
  receiver?: { name?: string; bank?: string; account?: string };
  /** Any mismatch we detected vs. expected values. */
  mismatch?: { field: "amount" | "receiver"; expected: unknown; got: unknown }[];
  /** Machine-readable failure reason when the provider could not verify/parse. */
  errorCode?: "provider_rejected" | "provider_error" | "receiver_unreadable";
  /** Provider-facing failure text for debugging/support UI. */
  errorMessage?: string;
  /** Provider used. */
  provider: SlipProvider;
  /** Raw provider response for debugging (only in non-production). */
  raw?: unknown;
}

function getProvider(): SlipProvider {
  const env = process.env.SLIP_VERIFY_PROVIDER?.toLowerCase();
  if (env === "slipok" || env === "easyslip") return env;
  return "mock";
}

export async function verifySlip(input: SlipVerifyInput): Promise<SlipVerifyResult> {
  if (!input.imageBase64 && !input.qrPayload) {
    throw new Error("ต้องส่ง imageBase64 หรือ qrPayload อย่างน้อย 1 อย่าง");
  }
  const provider = getProvider();
  switch (provider) {
    case "slipok":
      return verifyViaSlipOk(input);
    case "easyslip":
      return verifyViaEasySlip(input);
    default:
      return verifyViaMock(input);
  }
}

/**
 * SlipOK in **open verify mode** (`log: false`).
 *
 * Why `log: false` for SalePage:
 * - SalePage is multi-tenant — every shop has its own PromptPay receiver.
 * - With `log: true`, SlipOK rejects (error 1014) any slip whose receiver
 *   doesn't equal the branch's preconfigured account. That blocks shops
 *   other than the branch owner from using slip verify.
 * - With `log: false`, SlipOK validates the slip is real on the BoT network
 *   and returns parsed fields. SalePage then matches the slip's receiver
 *   against the shop's `promptpayId` in our own code (see receiver-match below).
 *
 * Downsides we mitigate:
 * - Quota is consumed regardless of match (vs `log:true` only-charged-on-match).
 *   Acceptable: it's how the StoreLink-style SaaS pattern works.
 * - SlipOK no longer guards against duplicate slips. Caller MUST persist
 *   `result.ref` and reject incoming slips with `ref` already seen for the
 *   same shop. (See `src/app/api/v1/slip/verify/route.ts` for the duplicate
 *   check once Orders flow lands.)
 */
async function verifyViaSlipOk(input: SlipVerifyInput): Promise<SlipVerifyResult> {
  const apiKey = process.env.SLIPOK_API_KEY;
  const branchId = process.env.SLIPOK_BRANCH_ID;
  if (!apiKey || !branchId) {
    throw new Error("ไม่ได้ตั้งค่า SLIPOK_API_KEY / SLIPOK_BRANCH_ID");
  }

  const body: Record<string, unknown> = { log: false };
  if (input.qrPayload) body.data = input.qrPayload;
  else if (input.imageBase64) body.data = input.imageBase64;
  if (input.expectAmount !== undefined) body.amount = input.expectAmount;

  let res: Response;
  try {
    res = await fetch(`https://api.slipok.com/api/line/apikey/${branchId}`, {
      method: "POST",
      headers: {
        "x-authorization": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return {
      verified: false,
      provider: "slipok",
      errorCode: "provider_error",
      errorMessage: err instanceof Error ? err.message : "SlipOK network error",
    };
  }
  const json = (await res.json()) as Record<string, unknown> & {
    success?: boolean;
    data?: Record<string, unknown>;
    code?: number;
    message?: string;
  };
  if (!res.ok || !json.success) {
    return {
      verified: false,
      provider: "slipok",
      errorCode: "provider_rejected",
      errorMessage: json.message ?? `SlipOK HTTP ${res.status}`,
      raw: process.env.NODE_ENV === "production" ? undefined : json,
    };
  }
  const data = json.data ?? {};
  const receiverAccount = nonEmptyString(
    pickString(data, ["receiver", "account", "value"]),
  ) ?? nonEmptyString(pickString(data, ["receiver", "proxy", "value"]));
  const receiverUnreadable = Boolean(input.expectReceiverId && !receiverAccount);

  // Manual receiver match — `log: false` means SlipOK didn't enforce this.
  const mismatch: NonNullable<SlipVerifyResult["mismatch"]> = [];
  if (input.expectReceiverId && receiverAccount) {
    const expectedTail = input.expectReceiverId.replace(/\D/g, "").slice(-4);
    const gotTail = receiverAccount.replace(/\D/g, "").slice(-4);
    if (expectedTail.length === 4 && expectedTail !== gotTail) {
      mismatch.push({
        field: "receiver",
        expected: input.expectReceiverId,
        got: receiverAccount,
      });
    }
  }

  return {
    verified: !receiverUnreadable && mismatch.length === 0,
    provider: "slipok",
    errorCode: receiverUnreadable ? "receiver_unreadable" : undefined,
    ref: pickString(data, ["transRef", "transactionId"]),
    amount: pickNumber(data, ["amount"]),
    transferredAt: pickString(data, ["transTimestamp", "transferredAt"]),
    sender: {
      name: pickString(data, ["sender", "name"]) ??
        pickString(data, ["sender", "displayName"]),
      bank: pickString(data, ["sender", "bank", "short"]) ??
        pickString(data, ["sendingBank"]),
      account: pickString(data, ["sender", "account", "value"]),
    },
    receiver: {
      name: pickString(data, ["receiver", "name"]) ??
        pickString(data, ["receiver", "displayName"]),
      bank: pickString(data, ["receiver", "bank", "short"]) ??
        pickString(data, ["receivingBank"]),
      account: receiverAccount,
    },
    mismatch: mismatch.length > 0 ? mismatch : undefined,
    raw: process.env.NODE_ENV === "production" ? undefined : json,
  };
}

async function verifyViaEasySlip(_input: SlipVerifyInput): Promise<SlipVerifyResult> {
  void _input;
  // Stub — to be implemented once the team picks Easyslip as primary.
  return {
    verified: false,
    provider: "easyslip",
  };
}

async function verifyViaMock(input: SlipVerifyInput): Promise<SlipVerifyResult> {
  await new Promise((r) => setTimeout(r, 600));
  const amount = input.expectAmount ?? 100;
  return {
    verified: true,
    provider: "mock",
    ref: "MOCK-" + Math.random().toString(36).slice(2, 10).toUpperCase(),
    amount,
    transferredAt: new Date().toISOString(),
    sender: { name: "นายทดสอบ ระบบ", bank: "KBANK", account: "xxx-x-x1234-x" },
    receiver: {
      name: "ร้าน SalePage Demo",
      bank: "SCB",
      account: input.expectReceiverId
        ? maskTail(input.expectReceiverId)
        : "xxx-x-x9999-x",
    },
  };
}

function maskTail(id: string) {
  const digits = id.replace(/\D/g, "");
  if (digits.length < 4) return digits;
  return "xxx-x-x" + digits.slice(-4) + "-x";
}

function pickString(obj: Record<string, unknown>, path: string[]): string | undefined {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur && typeof cur === "object" && key in cur) {
      cur = (cur as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return typeof cur === "string" ? cur : undefined;
}

function nonEmptyString(value: string | undefined) {
  return value?.trim() || undefined;
}

function pickNumber(obj: Record<string, unknown>, path: string[]): number | undefined {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur && typeof cur === "object" && key in cur) {
      cur = (cur as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return typeof cur === "number" ? cur : undefined;
}

export interface SlipOkQuota {
  ok: boolean;
  quota?: number;
  used?: number;
  remaining?: number;
  expireDate?: string;
  error?: string;
}

/// Fetches SlipOK remaining quota for the configured branch. Returns
/// { ok:false } with an error string if the API key is missing or call fails.
/// Surfaces on /admin overview as an early-warning gauge.
export async function getSlipOkQuota(): Promise<SlipOkQuota> {
  const apiKey = process.env.SLIPOK_API_KEY;
  const branchId = process.env.SLIPOK_BRANCH_ID;
  if (!apiKey || !branchId) {
    return { ok: false, error: "SLIPOK_API_KEY / SLIPOK_BRANCH_ID not set" };
  }
  try {
    const res = await fetch(
      `https://api.slipok.com/api/line/apikey/${branchId}/quota`,
      { headers: { "x-authorization": apiKey }, cache: "no-store" },
    );
    const json = (await res.json()) as {
      success?: boolean;
      data?: { quota?: number; specialQuota?: number; overQuota?: number; expireDate?: string };
      message?: string;
    };
    if (!res.ok || !json.success || !json.data) {
      return { ok: false, error: json.message ?? `HTTP ${res.status}` };
    }
    const quota = json.data.quota ?? 0;
    const overQuota = json.data.overQuota ?? 0;
    return {
      ok: true,
      quota,
      used: overQuota,
      remaining: Math.max(0, quota - overQuota),
      expireDate: json.data.expireDate,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
