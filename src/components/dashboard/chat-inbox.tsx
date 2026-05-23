"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Send, User } from "lucide-react";
import { cn } from "@/lib/cn";
import { buttonStyles } from "@/components/ui/button";

interface ConversationSummary {
  id: string;
  customerLineUserId: string;
  customerName: string | null;
  customerAvatar: string | null;
  lastMessageAt: string;
  lastMessageText: string | null;
  unreadCount: number;
}

interface MessageView {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  text: string | null;
  createdAt: string;
}

interface ConversationDetail extends ConversationSummary {
  messages: MessageView[];
}

interface Props {
  shopSlug: string;
  initialConversations: ConversationSummary[];
}

export function ChatInbox({ shopSlug, initialConversations }: Props) {
  const [conversations, setConversations] = useState<ConversationSummary[]>(
    initialConversations,
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    initialConversations[0]?.id ?? null,
  );
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  // Load full thread when a conversation is selected
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetail(null);
    fetch(`/api/v1/shops/${shopSlug}/conversations/${selectedId}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || !json.ok) return;
        setDetail(json.data.conversation);
        // Optimistically clear unread on the summary too
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedId ? { ...c, unreadCount: 0 } : c,
          ),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedId, shopSlug]);

  // Auto-scroll thread to bottom on new messages
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [detail?.messages?.length]);

  // Poll for new conversations every 15s
  useEffect(() => {
    const tick = async () => {
      try {
        const res = await fetch(
          `/api/v1/shops/${shopSlug}/conversations`,
        );
        const json = await res.json();
        if (json.ok) setConversations(json.data.conversations);
      } catch {}
    };
    const id = window.setInterval(tick, 15000);
    return () => window.clearInterval(id);
  }, [shopSlug]);

  async function sendReply() {
    if (!detail || !draft.trim()) return;
    setSending(true);
    try {
      const res = await fetch(
        `/api/v1/shops/${shopSlug}/conversations/${detail.id}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: draft.trim() }),
        },
      );
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error?.message ?? "ส่งไม่สำเร็จ");
        return;
      }
      setDetail((d) =>
        d
          ? {
              ...d,
              messages: [...d.messages, json.data.message],
              lastMessageAt: new Date().toISOString(),
              lastMessageText: draft.trim(),
            }
          : d,
      );
      setConversations((prev) =>
        prev.map((c) =>
          c.id === detail.id
            ? {
                ...c,
                lastMessageAt: new Date().toISOString(),
                lastMessageText: draft.trim(),
              }
            : c,
        ),
      );
      setDraft("");
    } finally {
      setSending(false);
    }
  }

  if (conversations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white px-6 py-14 text-center">
        <MessageCircle className="mx-auto size-8 text-zinc-300" />
        <p className="font-display mt-3 text-base font-semibold">
          ยังไม่มีข้อความเข้ามา
        </p>
        <p className="mt-1 text-[13px] text-zinc-500">
          ลูกค้าทักผ่าน LINE OA ของร้าน → ข้อความจะเด้งเข้ากล่องนี้ทันที
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
      {/* Conversation list */}
      <ul className="overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-white lg:max-h-[600px] lg:overflow-y-auto">
        {conversations.map((c) => {
          const active = c.id === selectedId;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-[color:var(--color-border)] px-4 py-3 text-left transition-colors last:border-b-0",
                  active
                    ? "bg-[color:var(--color-brand-50)]"
                    : "hover:bg-[color:var(--color-soft)]",
                )}
              >
                {c.customerAvatar ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={c.customerAvatar}
                    alt=""
                    className="size-9 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-400">
                    <User className="size-4" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-[13px] font-semibold">
                      {c.customerName ?? "ลูกค้า LINE"}
                    </p>
                    {c.unreadCount > 0 ? (
                      <span className="ml-auto rounded-full bg-[color:var(--color-brand-600)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {c.unreadCount}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-zinc-500">
                    {c.lastMessageText ?? "—"}
                  </p>
                  <p className="text-[10px] text-zinc-400">
                    {new Date(c.lastMessageAt).toLocaleString("th-TH", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Thread */}
      <div className="flex flex-col rounded-2xl border border-[color:var(--color-border)] bg-white lg:max-h-[600px]">
        {detail ? (
          <>
            <header className="flex items-center gap-3 border-b border-[color:var(--color-border)] px-4 py-3">
              {detail.customerAvatar ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={detail.customerAvatar}
                  alt=""
                  className="size-8 rounded-full object-cover"
                />
              ) : (
                <span className="grid size-8 place-items-center rounded-full bg-zinc-100 text-zinc-400">
                  <User className="size-4" />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {detail.customerName ?? "ลูกค้า LINE"}
                </p>
                <p className="font-mono text-[10px] text-zinc-400">
                  {detail.customerLineUserId.slice(0, 8)}...
                </p>
              </div>
            </header>

            <div
              ref={threadRef}
              className="flex-1 space-y-2 overflow-y-auto p-4 text-[14px]"
            >
              {detail.messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "flex",
                    m.direction === "OUTBOUND" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[75%] whitespace-pre-line rounded-2xl px-3.5 py-2",
                      m.direction === "OUTBOUND"
                        ? "bg-[color:var(--color-brand-600)] text-white"
                        : "bg-[color:var(--color-soft)] text-zinc-800",
                    )}
                  >
                    {m.text}
                    <p
                      className={cn(
                        "mt-1 text-right text-[10px]",
                        m.direction === "OUTBOUND"
                          ? "text-white/70"
                          : "text-zinc-400",
                      )}
                    >
                      {new Date(m.createdAt).toLocaleTimeString("th-TH", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-[color:var(--color-border)] p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      void sendReply();
                    }
                  }}
                  rows={2}
                  maxLength={5000}
                  placeholder="พิมพ์ข้อความตอบลูกค้า..."
                  className="flex-1 resize-none rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2 text-[14px] outline-none focus:border-[color:var(--color-brand-400)]"
                />
                <button
                  type="button"
                  onClick={sendReply}
                  disabled={sending || !draft.trim()}
                  className={cn(
                    buttonStyles({ size: "md" }),
                    "gap-1.5 disabled:opacity-50",
                  )}
                >
                  <Send className="size-4" />
                  {sending ? "..." : "ส่ง"}
                </button>
              </div>
              <p className="mt-1 text-[10px] text-zinc-400">
                ส่งผ่าน LINE Push API · ⌘/Ctrl+Enter เพื่อส่ง
              </p>
            </div>
          </>
        ) : (
          <div className="grid h-full place-items-center p-8 text-center">
            <p className="text-sm text-zinc-500">เลือกบทสนทนาทางซ้าย</p>
          </div>
        )}
      </div>
    </div>
  );
}
