"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronRight, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import {
  buildLiffRedirectUri,
  buildLineOpenBridgePath,
  fetchLineConfig,
  hasUsableLiffContext,
  initLineLiff,
  isLineInAppBrowser,
  type LiffClient,
  type LineConfig,
} from "@/lib/line-liff-client";

interface Props {
  token: string;
  initiallyLinked: boolean;
  displayName?: string | null;
  pictureUrl?: string | null;
}

export function LineOrderLinker({
  token,
  initiallyLinked,
  displayName,
  pictureUrl,
}: Props) {
  const [config, setConfig] = useState<LineConfig | null>(null);
  const [linked, setLinked] = useState(initiallyLinked);
  const [lineName, setLineName] = useState(displayName ?? "");
  const [linePicture, setLinePicture] = useState(pictureUrl ?? "");
  const [busy, setBusy] = useState(false);
  const autoLinkAttempted = useRef(false);

  const linkWithLine = useCallback(async (liff: LiffClient, silent = false) => {
    const idToken = liff.getIDToken();
    if (!idToken) {
      if (!silent) {
        toast.error("LINE ยังไม่ส่งสิทธิ์ยืนยันตัวตน", {
          description: "กรุณาเปิดผ่าน LINE หรือ Login LINE อีกครั้ง",
        });
      }
      return false;
    }

    const res = await fetch(`/api/v1/orders/${encodeURIComponent(token)}/line`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      if (!silent) toast.error(json.error?.message ?? "ผูก LINE ไม่สำเร็จ");
      return false;
    }

    setLinked(true);
    setLineName(json.data.profile.displayName ?? "");
    setLinePicture(json.data.profile.pictureUrl ?? "");
    if (!silent) toast.success("บันทึกช่องทางเช็กสถานะแล้ว");
    return true;
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    fetchLineConfig()
      .then((lineConfig) => {
        if (cancelled) return;
        setConfig(lineConfig);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!config?.liffId || linked || autoLinkAttempted.current) return;
    if (!hasUsableLiffContext()) return;

    let cancelled = false;
    autoLinkAttempted.current = true;
    queueMicrotask(() => {
      if (!cancelled) setBusy(true);
    });

    initLineLiff(config.liffId)
      .then(async (liff) => {
        if (cancelled) return;
        if (!liff.isLoggedIn()) {
          if (isLineInAppBrowser()) {
            liff.login({ redirectUri: buildLiffRedirectUri() });
          }
          return;
        }
        await linkWithLine(liff, true);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [config?.liffId, linked, linkWithLine]);

  if (!config?.configured) return null;

  async function handleClick() {
    if (!config?.liffId || busy) return;
    setBusy(true);
    try {
      if (!hasUsableLiffContext()) {
        window.location.assign(buildLineOpenBridgePath());
        return;
      }

      const liff = await initLineLiff(config.liffId);
      if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: buildLiffRedirectUri() });
        return;
      }
      await linkWithLine(liff);
    } catch (e) {
      toast.error("เชื่อมต่อ LINE ไม่สำเร็จ", {
        description: e instanceof Error ? e.message : "กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setBusy(false);
    }
  }

  if (linked) {
    return (
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white text-emerald-600 shadow-sm">
            {linePicture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={linePicture} alt="" className="size-full object-cover" />
            ) : (
              <CheckCircle2 className="size-5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-emerald-950">
              พร้อมเช็กสถานะผ่าน LINE แล้ว
            </p>
            <p className="truncate text-xs text-emerald-800">
              {lineName || "ครั้งต่อไปดูสถานะออเดอร์ได้ทันที"}
            </p>
          </div>
          <Link
            href="/line/orders"
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full bg-white px-3 text-xs font-bold text-emerald-700 shadow-sm"
          >
            ออเดอร์ <ChevronRight className="ml-0.5 size-4" />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#06C755] text-white">
            <MessageCircle className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold">บันทึกออเดอร์ไว้กับ LINE</p>
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-600">
              ไม่จำเป็นต้องทำตอนนี้ จ่ายเงินให้เสร็จก่อนได้ แล้วค่อยผูกไว้ดูครั้งหน้า
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClick}
          disabled={busy || !config?.liffId}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#06C755] px-4 text-sm font-bold text-white shadow-lg shadow-emerald-100 transition active:scale-[0.99] disabled:opacity-60 sm:w-auto"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
          ผูก LINE ไว้ดูครั้งหน้า
        </button>
      </div>
    </section>
  );
}
