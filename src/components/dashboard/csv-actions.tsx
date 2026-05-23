"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { buttonStyles } from "@/components/ui/button";

interface Props {
  shopSlug: string;
}

interface ImportRow {
  row: number;
  ok: boolean;
  slug?: string;
  action?: "created" | "updated";
  error?: string;
}

export function CsvActions({ shopSlug }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [report, setReport] = useState<{
    total: number;
    created: number;
    updated: number;
    failed: number;
    results: ImportRow[];
  } | null>(null);

  function pickFile() {
    fileRef.current?.click();
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setReport(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(
        `/api/v1/shops/${shopSlug}/products/import`,
        { method: "POST", body: form },
      );
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error?.message ?? "อัปโหลดไม่สำเร็จ");
        return;
      }
      setReport(json.data);
      toast.success(
        `นำเข้าสำเร็จ: สร้าง ${json.data.created} · อัปเดต ${json.data.updated}${
          json.data.failed ? ` · ผิดพลาด ${json.data.failed}` : ""
        }`,
      );
      // Refresh server data
      window.setTimeout(() => window.location.reload(), 800);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-2">
      <a
        href={`/api/v1/shops/${shopSlug}/products/export`}
        className={cn(buttonStyles({ size: "sm", variant: "outline" }), "gap-1.5")}
      >
        <Download className="size-3.5" /> Export CSV
      </a>
      <button
        type="button"
        onClick={pickFile}
        disabled={uploading}
        className={cn(buttonStyles({ size: "sm", variant: "outline" }), "gap-1.5")}
      >
        <Upload className="size-3.5" /> {uploading ? "กำลังนำเข้า..." : "Import CSV"}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        onChange={upload}
        className="hidden"
      />

      {report && report.failed > 0 ? (
        <div className="absolute mt-2 max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800 shadow-lg">
          <p className="font-semibold">
            <FileSpreadsheet className="mr-1 inline size-3.5" />
            {report.failed} แถวมีปัญหา:
          </p>
          <ul className="mt-1.5 space-y-1">
            {report.results
              .filter((r) => !r.ok)
              .slice(0, 6)
              .map((r) => (
                <li key={r.row}>
                  แถว {r.row}: {r.error}
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
