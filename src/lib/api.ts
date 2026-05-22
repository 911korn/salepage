import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiSuccess<T>>({ ok: true, data }, init);
}

export function fail(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
) {
  return NextResponse.json<ApiError>(
    { ok: false, error: { code, message, details } },
    { status },
  );
}

export async function parseJson<T>(
  request: Request,
  schema: ZodSchema<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: fail("invalid_json", "Body ไม่ใช่ JSON ที่ถูกต้อง", 400),
    };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: fail(
        "validation_error",
        "ข้อมูลไม่ผ่านการตรวจสอบ",
        422,
        flattenZod(result.error),
      ),
    };
  }
  return { ok: true, data: result.data };
}

function flattenZod(err: ZodError) {
  return err.issues.map((issue) => ({
    path: issue.path.join("."),
    code: issue.code,
    message: issue.message,
  }));
}
