import "server-only";
import { PaymentGatewayProvider, PaymentGatewayMode } from "@/lib/db";

/**
 * Provider-specific adapters — currently only `testConnection()` is wired
 * in (Phase 1: storage + validation). Phase 2 will add `charge()`,
 * `refund()`, `parseWebhook()` per provider so the buyer checkout can
 * actually route through the seller's gateway.
 *
 * Every adapter shares the same testConnection signature so the API
 * route doesn't need a switch — it just dispatches by provider key.
 */

export interface TestConnectionInput {
  publicKey: string;
  secretKey: string;
  mode: PaymentGatewayMode;
}

export interface TestConnectionResult {
  ok: boolean;
  /** Provider-specific account display (e.g. Stripe account name, Omise
   *  email). Surfaced in the dashboard so the seller knows which account
   *  these keys are for. */
  accountLabel?: string;
  /** Error message if ok=false. */
  errorMessage?: string;
}

type Adapter = (input: TestConnectionInput) => Promise<TestConnectionResult>;

const ADAPTERS: Record<PaymentGatewayProvider, Adapter> = {
  OMISE: testOmise,
  STRIPE: testStripe,
  KSHER: testGenericKeyShape("Ksher"),
  C2P: testGenericKeyShape("2C2P"),
  GBPRIMEPAY: testGenericKeyShape("GBPrimePay"),
  PAYSOLUTIONS: testGenericKeyShape("PaySolutions"),
  KBANK: testGenericKeyShape("K-Payment Gateway"),
  SCB: testGenericKeyShape("SCB"),
  KRUNGSRI: testGenericKeyShape("Krungsri"),
  TRUEMONEY: testGenericKeyShape("TrueMoney"),
  RABBIT_LINEPAY: testGenericKeyShape("Rabbit LINE Pay"),
  PAYPAL: testPayPal,
};

export async function testConnection(
  provider: PaymentGatewayProvider,
  input: TestConnectionInput,
): Promise<TestConnectionResult> {
  const adapter = ADAPTERS[provider];
  if (!adapter) {
    return { ok: false, errorMessage: `Unknown provider: ${provider}` };
  }
  try {
    return await adapter(input);
  } catch (err) {
    return {
      ok: false,
      errorMessage: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Omise — GET https://api.omise.co/account with HTTP Basic auth using the
 * secret key as username. Returns the account row when keys are valid.
 *
 * Their docs: https://docs.opn.ooo/api-account
 */
async function testOmise(input: TestConnectionInput): Promise<TestConnectionResult> {
  // Sanity-check the key shape before making a network call.
  if (!input.secretKey.startsWith("skey_")) {
    return {
      ok: false,
      errorMessage: "Omise secret key ต้องขึ้นต้นด้วย skey_ (test/live)",
    };
  }
  const expectMode =
    input.mode === PaymentGatewayMode.LIVE ? "skey_live" : "skey_test";
  if (!input.secretKey.startsWith(expectMode)) {
    return {
      ok: false,
      errorMessage: `Mode = ${input.mode} แต่ key เป็น ${input.secretKey.slice(0, 9)}_ — ไม่ตรงกัน`,
    };
  }
  const res = await fetch("https://api.omise.co/account", {
    headers: {
      authorization: `Basic ${Buffer.from(input.secretKey + ":").toString("base64")}`,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    return {
      ok: false,
      errorMessage: `Omise HTTP ${res.status}: ${body.slice(0, 200)}`,
    };
  }
  const json = (await res.json()) as { email?: string; team?: string; id?: string };
  return {
    ok: true,
    accountLabel: json.email ?? json.team ?? json.id ?? "Omise account",
  };
}

/**
 * Stripe — GET https://api.stripe.com/v1/accounts/account with HTTP Basic
 * auth using the secret key. Returns the connected account's
 * business_profile.name when keys are valid.
 */
async function testStripe(input: TestConnectionInput): Promise<TestConnectionResult> {
  if (!input.secretKey.startsWith("sk_")) {
    return {
      ok: false,
      errorMessage: "Stripe secret key ต้องขึ้นต้นด้วย sk_test_ หรือ sk_live_",
    };
  }
  const expectMode = input.mode === PaymentGatewayMode.LIVE ? "sk_live_" : "sk_test_";
  if (!input.secretKey.startsWith(expectMode)) {
    return {
      ok: false,
      errorMessage: `Mode = ${input.mode} แต่ key เป็น ${input.secretKey.slice(0, 8)}* — ไม่ตรงกัน`,
    };
  }
  const res = await fetch("https://api.stripe.com/v1/account", {
    headers: {
      authorization: `Basic ${Buffer.from(input.secretKey + ":").toString("base64")}`,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    return {
      ok: false,
      errorMessage: `Stripe HTTP ${res.status}: ${body.slice(0, 200)}`,
    };
  }
  const json = (await res.json()) as {
    id?: string;
    email?: string;
    business_profile?: { name?: string };
    settings?: { dashboard?: { display_name?: string } };
  };
  return {
    ok: true,
    accountLabel:
      json.business_profile?.name ??
      json.settings?.dashboard?.display_name ??
      json.email ??
      json.id ??
      "Stripe account",
  };
}

/**
 * PayPal — OAuth client_credentials grant. POST to the v1/oauth2/token
 * endpoint with Basic auth = client_id:client_secret → returns an
 * access_token if the keys are valid.
 */
async function testPayPal(input: TestConnectionInput): Promise<TestConnectionResult> {
  const base =
    input.mode === PaymentGatewayMode.LIVE
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${input.publicKey}:${input.secretKey}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const body = await res.text();
    return {
      ok: false,
      errorMessage: `PayPal HTTP ${res.status}: ${body.slice(0, 200)}`,
    };
  }
  return { ok: true, accountLabel: `PayPal ${input.mode}` };
}

/**
 * Generic adapter for providers without a public test-keys endpoint we
 * can hit cheaply (or that require complex signed requests just to ping).
 * We do basic shape-validation and trust the seller — Phase 2 will replace
 * each with a real connectivity check via that provider's auth/echo API.
 */
function testGenericKeyShape(name: string): Adapter {
  return async (input: TestConnectionInput) => {
    if (!input.publicKey || input.publicKey.length < 4) {
      return { ok: false, errorMessage: `${name}: public key ดูสั้นเกินไป` };
    }
    if (!input.secretKey || input.secretKey.length < 8) {
      return { ok: false, errorMessage: `${name}: secret key ดูสั้นเกินไป` };
    }
    return {
      ok: true,
      accountLabel: `${name} (${input.mode}) — บันทึกแล้ว · live-charge integration ตามมา Phase 2`,
    };
  };
}
