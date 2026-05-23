import { del, put } from "@vercel/blob";
import { ok, fail } from "@/lib/api";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
]);

/**
 * POST /api/v1/upload — auth-required image upload.
 *
 * Accepts a `multipart/form-data` with field `file` (preferred for browser
 * file pickers), OR raw JSON `{ filename, contentType, dataBase64 }` for
 * programmatic clients (mobile app later).
 *
 * Returns `{ url, pathname, contentType, size }`. The URL is a public CDN
 * URL hosted on Vercel Blob — paste it into ProductForm.imageUrls.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return fail("unauthorized", "Sign in required", 401);

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return fail(
      "blob_not_configured",
      "Image upload not configured on this deployment",
      503,
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  let file: { name: string; type: string; bytes: Uint8Array };

  if (contentType.startsWith("multipart/form-data")) {
    const form = await request.formData();
    const f = form.get("file");
    if (!(f instanceof File)) {
      return fail("missing_file", "Field 'file' is required", 400);
    }
    if (!ALLOWED_TYPES.has(f.type)) {
      return fail("bad_type", `Unsupported type ${f.type}`, 415);
    }
    if (f.size > MAX_BYTES) {
      return fail("too_large", `Max ${MAX_BYTES} bytes`, 413);
    }
    file = {
      name: f.name,
      type: f.type,
      bytes: new Uint8Array(await f.arrayBuffer()),
    };
  } else if (contentType.startsWith("application/json")) {
    const json = (await request.json()) as {
      filename?: string;
      contentType?: string;
      dataBase64?: string;
    };
    if (!json.dataBase64 || !json.contentType || !json.filename) {
      return fail(
        "missing_fields",
        "JSON body must include filename, contentType, dataBase64",
        400,
      );
    }
    if (!ALLOWED_TYPES.has(json.contentType)) {
      return fail("bad_type", `Unsupported type ${json.contentType}`, 415);
    }
    const bytes = Uint8Array.from(Buffer.from(json.dataBase64, "base64"));
    if (bytes.byteLength > MAX_BYTES) {
      return fail("too_large", `Max ${MAX_BYTES} bytes`, 413);
    }
    file = { name: json.filename, type: json.contentType, bytes };
  } else {
    return fail(
      "bad_content_type",
      "Expected multipart/form-data or application/json",
      400,
    );
  }

  // Namespace by user id so dashboards stay tidy + no path collisions.
  const safeName = file.name.replace(/[^\w.-]/g, "_").slice(-60);
  const pathname = `u/${session.user.id}/${Date.now()}-${safeName}`;

  const result = await put(pathname, Buffer.from(file.bytes), {
    access: "public",
    contentType: file.type,
    addRandomSuffix: false,
  });

  return ok(
    {
      url: result.url,
      pathname: result.pathname,
      contentType: result.contentType,
      size: file.bytes.byteLength,
    },
    { status: 201 },
  );
}

/**
 * DELETE /api/v1/upload — delete uploaded product images owned by this user.
 *
 * Accepts JSON `{ url }` or `{ urls }`. Only blobs under `u/<userId>/...`
 * can be deleted, so a merchant cannot delete another account's files even
 * if they know the public Blob URL.
 */
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return fail("unauthorized", "Sign in required", 401);

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return fail(
      "blob_not_configured",
      "Image upload not configured on this deployment",
      503,
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { url?: unknown; urls?: unknown }
    | null;
  const requested = Array.isArray(body?.urls)
    ? body.urls
    : body?.url
      ? [body.url]
      : [];

  const urls = requested
    .filter((value): value is string => typeof value === "string")
    .slice(0, 20);
  if (urls.length === 0) {
    return fail("missing_url", "Provide url or urls", 400);
  }

  const pathnames = urls.map((url) =>
    getOwnedUploadPathname(url, session.user.id),
  );
  if (pathnames.some((pathname) => !pathname)) {
    return fail("forbidden", "Can only delete your own uploaded images", 403);
  }

  await del(pathnames as string[]);
  return ok({ deleted: pathnames.length });
}

function getOwnedUploadPathname(value: string, userId: string) {
  let pathname = value.trim();
  try {
    const parsed = new URL(pathname);
    pathname = parsed.pathname;
  } catch {
    // Accept pathnames from API clients in addition to full Blob URLs.
  }

  pathname = decodeURIComponent(pathname)
    .replace(/^\/+/, "")
    .split(/[?#]/)[0];

  return pathname.startsWith(`u/${userId}/`) ? pathname : null;
}
