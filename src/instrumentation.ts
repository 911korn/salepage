import type { Instrumentation } from "next";

export async function register() {}

// Every uncaught server error (route handlers, server components, actions)
// lands in the ErrorEvent table — see src/lib/error-log.ts. Edge requests are
// skipped: the Prisma client is only loaded in the Node.js runtime.
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const error = err as Error & { digest?: string };
  const { recordError } = await import("@/lib/error-log");
  const ua = request.headers["user-agent"];
  await recordError({
    source: "server",
    message: `${error.message ?? String(err)}${error.digest ? ` [digest ${error.digest}]` : ""}`,
    stack: error.stack,
    path: `${request.method} ${request.path} (${context.routeType} ${context.routePath})`,
    userAgent: Array.isArray(ua) ? ua[0] : ua,
  });
};
