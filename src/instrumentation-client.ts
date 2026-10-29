// Browser errors → POST /api/v1/errors → ErrorEvent table (/admin/errors).
// At most a few reports per page load, and noise we can't act on is dropped.

const MAX_REPORTS = 5;
const sent = new Set<string>();

const IGNORED = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /extension:\/\//i,
  /Load failed$/i,
  /Failed to fetch$/i,
  /NetworkError when attempting to fetch/i,
  /AbortError/i,
];

function report(message: string, stack?: string) {
  if (!message || IGNORED.some((re) => re.test(message) || (stack && re.test(stack)))) return;
  if (sent.size >= MAX_REPORTS || sent.has(message)) return;
  sent.add(message);
  const body = JSON.stringify({
    message,
    stack: stack?.slice(0, 6000),
    path: window.location.pathname,
  });
  try {
    if (!navigator.sendBeacon?.("/api/v1/errors", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/v1/errors", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } });
    }
  } catch {
    // never let reporting throw
  }
}

window.addEventListener("error", (event) => {
  const err = event.error as Error | undefined;
  report(err?.message ?? event.message, err?.stack);
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason as unknown;
  if (reason instanceof Error) report(reason.message, reason.stack);
  else report(typeof reason === "string" ? reason : "Unhandled promise rejection");
});
