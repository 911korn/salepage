export const LIFF_RETURN_PARAM = "sp_liff";
export const LIFF_STATE_PARAM = "liff.state";

const MAX_LIFF_STATE_DEPTH = 8;

export function toPathWithSearchAndHash(url: URL): string {
  return `${url.pathname}${url.search}${url.hash}`;
}

export function ensureLiffReturnParam(url: URL): URL {
  const next = new URL(url.toString());
  next.searchParams.delete(LIFF_STATE_PARAM);
  next.searchParams.set(LIFF_RETURN_PARAM, "1");
  return next;
}

export function sanitizeLiffTargetUrl(targetHref: string, baseHref?: string): URL {
  const target = new URL(targetHref, baseHref);
  const nestedState = target.searchParams.get(LIFF_STATE_PARAM);
  if (nestedState && target.pathname === "/") {
    const resolved = resolveLiffStateTarget(nestedState, target.toString());
    if (resolved) return stripLiffState(resolved);
  }
  return stripLiffState(target);
}

export function resolveLiffStateTarget(
  rawState: string | null | undefined,
  requestHref: string,
): URL | null {
  if (!rawState) return null;

  const base = new URL(requestHref);
  const seen = new Set<string>();
  let state = rawState.trim();

  for (let depth = 0; depth < MAX_LIFF_STATE_DEPTH; depth += 1) {
    if (!state || seen.has(state)) return null;
    seen.add(state);

    const decoded = decodeOnce(state);
    if (decoded !== state) {
      state = decoded.trim();
      continue;
    }

    if (state.startsWith("?")) {
      const params = new URLSearchParams(state.slice(1));
      const nested = params.get(LIFF_STATE_PARAM);
      if (nested) {
        state = nested.trim();
        continue;
      }
      return stripLiffState(new URL(`${base.pathname}${state}`, base));
    }

    let target: URL | null = null;
    try {
      if (state.startsWith("/") && !state.startsWith("//")) {
        target = new URL(state, base);
      } else if (/^https?:\/\//i.test(state)) {
        target = new URL(state);
        if (target.origin !== base.origin) return null;
      } else {
        return null;
      }
    } catch {
      return null;
    }

    const nested = target.searchParams.get(LIFF_STATE_PARAM);
    if (nested && target.pathname === "/") {
      target.searchParams.delete(LIFF_STATE_PARAM);
      const resolved = resolveLiffStateTarget(nested, target.toString());
      if (resolved) return stripLiffState(resolved);
    }

    return stripLiffState(target);
  }

  return null;
}

function stripLiffState(url: URL): URL {
  const next = new URL(url.toString());
  next.searchParams.delete(LIFF_STATE_PARAM);
  return next;
}

function decodeOnce(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, "%20"));
  } catch {
    return value;
  }
}
