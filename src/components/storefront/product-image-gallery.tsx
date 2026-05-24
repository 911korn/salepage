"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

interface ProductImageGalleryProps {
  images: string[];
  productName: string;
  badge: "HOT" | "NEW" | "SALE" | null;
  discountPct: number;
}

export function ProductImageGallery({
  images,
  productName,
  badge,
  discountPct,
}: ProductImageGalleryProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const hasImages = images.length > 0;
  const canSlide = images.length > 1;

  function goTo(index: number) {
    const nextIndex = Math.max(0, Math.min(index, images.length - 1));
    const track = trackRef.current;
    setActiveIndex(nextIndex);
    track?.scrollTo({
      left: track.clientWidth * nextIndex,
      behavior: "smooth",
    });
  }

  function handleScroll() {
    const track = trackRef.current;
    if (!track || !track.clientWidth) return;
    const nextIndex = Math.round(track.scrollLeft / track.clientWidth);
    if (nextIndex !== activeIndex) {
      setActiveIndex(nextIndex);
    }
  }

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-3xl border border-[color:var(--color-border)] bg-white">
      <div className="relative aspect-square w-full bg-zinc-100">
        {hasImages ? (
          <div
            ref={trackRef}
            onScroll={handleScroll}
            className="flex size-full snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {images.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt={images.length > 1 ? `${productName} ${i + 1}` : productName}
                className="size-full shrink-0 snap-center object-cover"
                draggable={false}
              />
            ))}
          </div>
        ) : (
          <div
            className="size-full"
            style={{
              background:
                "linear-gradient(135deg, var(--color-brand-100), var(--color-brand-300))",
            }}
          />
        )}

        {badge ? (
          <span
            className={cn(
              "absolute left-3 top-3 rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white",
              badge === "HOT" && "bg-orange-500",
              badge === "NEW" && "bg-emerald-500",
              badge === "SALE" && "bg-[color:var(--color-brand-600)]",
            )}
          >
            {badge}
          </span>
        ) : null}

        {discountPct > 0 ? (
          <span className="absolute right-3 top-3 rounded-md bg-black/80 px-2.5 py-1 text-[11px] font-bold text-white">
            -{discountPct}%
          </span>
        ) : null}

        {canSlide ? (
          <>
            <button
              type="button"
              onClick={() => goTo(activeIndex - 1)}
              className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white/70 bg-white/88 text-zinc-800 shadow-lg backdrop-blur transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand-500)] disabled:pointer-events-none disabled:opacity-35"
              aria-label="รูปก่อนหน้า"
              disabled={activeIndex === 0}
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => goTo(activeIndex + 1)}
              className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white/70 bg-white/88 text-zinc-800 shadow-lg backdrop-blur transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand-500)] disabled:pointer-events-none disabled:opacity-35"
              aria-label="รูปถัดไป"
              disabled={activeIndex === images.length - 1}
            >
              <ChevronRight className="size-5" />
            </button>

            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1.5 backdrop-blur">
              {images.map((url, i) => (
                <button
                  key={`${url}-dot`}
                  type="button"
                  onClick={() => goTo(i)}
                  className={cn(
                    "size-1.5 rounded-full bg-white/55 transition",
                    i === activeIndex && "w-4 bg-white",
                  )}
                  aria-label={`ไปยังรูปที่ ${i + 1}`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {canSlide ? (
        <div className="flex gap-2 overflow-x-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {images.map((url, i) => (
            <button
              key={`${url}-thumb`}
              type="button"
              onClick={() => goTo(i)}
              className={cn(
                "size-20 shrink-0 overflow-hidden rounded-lg bg-zinc-100 ring-1 ring-[color:var(--color-border)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand-500)]",
                i === activeIndex &&
                  "ring-2 ring-[color:var(--color-brand-600)] ring-offset-2 ring-offset-white",
              )}
              aria-label={`เปิดรูปที่ ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="size-full object-cover"
                draggable={false}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
