"use client";

export const LIFF_RETURN_PARAM = "sp_liff";

const LIFF_ACTIVE_KEY = "salepage:line-liff-active";

export interface LineConfig {
  liffId: string | null;
  configured: boolean;
}

export interface LiffClient {
  init: (opts: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  login: (opts?: { redirectUri?: string }) => void;
  getIDToken: () => string | null;
}

type LiffWindow = Window & { liff?: LiffClient };

let configPromise: Promise<LineConfig> | null = null;
let liffScriptPromise: Promise<LiffClient> | null = null;
let liffInit:
  | {
      id: string;
      promise: Promise<LiffClient>;
    }
  | null = null;

export function isLineInAppBrowser(userAgent = navigator.userAgent): boolean {
  return /\bLine\//i.test(userAgent);
}

export function hasLiffReturnParam(): boolean {
  return new URL(window.location.href).searchParams.get(LIFF_RETURN_PARAM) === "1";
}

export function markLiffActive() {
  try {
    window.sessionStorage.setItem(LIFF_ACTIVE_KEY, "1");
  } catch {
    /* sessionStorage can be blocked in some in-app browser privacy modes */
  }
}

export function isLiffActiveSession(): boolean {
  try {
    return window.sessionStorage.getItem(LIFF_ACTIVE_KEY) === "1";
  } catch {
    return false;
  }
}

export function cleanLiffReturnParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(LIFF_RETURN_PARAM)) return;
  url.searchParams.delete(LIFF_RETURN_PARAM);
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

export function buildLiffUrl(liffId: string, targetHref: string): string {
  const target = new URL(targetHref);
  target.searchParams.set(LIFF_RETURN_PARAM, "1");
  return `https://liff.line.me/${liffId}${target.pathname}${target.search}${target.hash}`;
}

export async function fetchLineConfig(): Promise<LineConfig> {
  if (configPromise) return configPromise;

  configPromise = fetch("/api/v1/line/config", { cache: "no-store" })
    .then((r) => r.json())
    .then((json) => {
      if (!json.ok || !json.data?.configured || !json.data?.liffId) {
        return { liffId: null, configured: false };
      }
      return {
        liffId: String(json.data.liffId),
        configured: true,
      };
    })
    .catch(() => ({ liffId: null, configured: false }));

  return configPromise;
}

export async function initLineLiff(liffId: string): Promise<LiffClient> {
  if (liffInit?.id === liffId) return liffInit.promise;

  liffInit = {
    id: liffId,
    promise: loadLiffSdk().then(async (liff) => {
      await liff.init({ liffId });
      return liff;
    }),
  };

  return liffInit.promise;
}

export async function getLineIdTokenIfAvailable(): Promise<string | null> {
  if (!isLineInAppBrowser() && !isLiffActiveSession() && !hasLiffReturnParam()) {
    return null;
  }

  const config = await fetchLineConfig();
  if (!config.configured || !config.liffId) return null;

  const liff = await initLineLiff(config.liffId);
  if (!liff.isLoggedIn()) return null;
  return liff.getIDToken();
}

function loadLiffSdk(): Promise<LiffClient> {
  const win = window as LiffWindow;
  if (win.liff) return Promise.resolve(win.liff);
  if (liffScriptPromise) return liffScriptPromise;

  liffScriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById("line-liff-sdk") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => {
        const current = (window as LiffWindow).liff;
        if (current) resolve(current);
        else reject(new Error("LIFF SDK missing"));
      });
      existing.addEventListener("error", () => reject(new Error("LIFF SDK load failed")));
      return;
    }

    const script = document.createElement("script");
    script.id = "line-liff-sdk";
    script.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
    script.async = true;
    script.onload = () => {
      const current = (window as LiffWindow).liff;
      if (current) resolve(current);
      else reject(new Error("LIFF SDK missing"));
    };
    script.onerror = () => reject(new Error("LIFF SDK load failed"));
    document.head.appendChild(script);
  });

  return liffScriptPromise;
}
