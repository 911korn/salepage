import "server-only";

/**
 * Tiny Vercel API client — just enough to attach / detach a hostname
 * to/from our project. Vercel needs to know "this hostname maps to
 * salepage project" so when CF proxies the request to 76.76.21.21,
 * the Vercel router knows which project to serve. SSL is also issued
 * by Vercel once the domain is attached + DNS resolves to Vercel IP.
 *
 * Keep this scoped narrow — most heavy lifting lives in
 * src/lib/cloudflare-zones.ts. We use Vercel here ONLY as the "who
 * owns this hostname" registry on the anycast layer.
 */

const VERCEL_API = "https://api.vercel.com";

function client() {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token) throw new Error("VERCEL_API_TOKEN not set");
  if (!projectId) throw new Error("VERCEL_PROJECT_ID not set");
  return { token, projectId, teamId: process.env.VERCEL_TEAM_ID };
}

function teamQuery(teamId: string | undefined): string {
  return teamId ? `?teamId=${teamId}` : "";
}

async function vercel<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const c = client();
  const res = await fetch(`${VERCEL_API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${c.token}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.text();
  let parsed: unknown;
  try {
    parsed = body ? JSON.parse(body) : null;
  } catch {
    parsed = body;
  }
  if (!res.ok) {
    const errInfo =
      parsed &&
      typeof parsed === "object" &&
      "error" in parsed &&
      typeof (parsed as { error: { message?: string } }).error === "object"
        ? (parsed as { error: { message?: string; code?: string } }).error
        : null;
    throw new Error(
      `Vercel API ${res.status} ${errInfo?.code ?? ""} — ${errInfo?.message ?? body.slice(0, 200)}`,
    );
  }
  return parsed as T;
}

export async function attachDomainToProject(domain: string): Promise<void> {
  const c = client();
  await vercel(
    `/v10/projects/${c.projectId}/domains${teamQuery(c.teamId)}`,
    {
      method: "POST",
      body: JSON.stringify({ name: domain }),
    },
  );
}

export async function detachDomainFromProject(domain: string): Promise<void> {
  const c = client();
  try {
    await vercel(
      `/v9/projects/${c.projectId}/domains/${encodeURIComponent(domain)}${teamQuery(c.teamId)}`,
      { method: "DELETE" },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("404") || msg.toLowerCase().includes("not_found")) {
      return;
    }
    throw err;
  }
}
