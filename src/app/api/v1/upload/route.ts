import { del, put } from "@vercel/blob";
import { ok, fail } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import { moderateImage } from "@/lib/content-moderation";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES_IMAGE = 5 * 1024 * 1024; // 5 MB — product / slip / story thumbnails
const MAX_BYTES_VIDEO = 25 * 1024 * 1024; // 25 MB — ~15s 720p H.264 stories
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/quicktime"]);
const ALLOWED_TYPES = new Set([...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES]);

function maxBytesFor(type: string): number {
  return ALLOWED_VIDEO_TYPES.has(type) ? MAX_BYTES_VIDEO : MAX_BYTES_IMAGE;
}

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
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

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
    const cap = maxBytesFor(f.type);
    if (f.size > cap) {
      return fail("too_large", `Max ${cap} bytes`, 413);
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
    const cap = maxBytesFor(json.contentType);
    if (bytes.byteLength > cap) {
      return fail("too_large", `Max ${cap} bytes`, 413);
    }
    file = { name: json.filename, type: json.contentType, bytes };
  } else {
    return fail(
      "bad_content_type",
      "Expected multipart/form-data or application/json",
      400,
    );
  }

  // Apple Guideline 1.2 — moderate every image before it touches Blob.
  // Videos are skipped (Claude vision doesn't take video frames in this
  // path; mobile story flow does a separate prompt before upload).
  if (ALLOWED_IMAGE_TYPES.has(file.type)) {
    const verdict = await moderateImage(Buffer.from(file.bytes), file.type);
    if (!verdict.ok) {
      return fail("blocked_by_moderation", verdict.reason, 422);
    }
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
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

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
