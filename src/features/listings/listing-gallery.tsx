"use client";

import { useRef, useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type GalleryImage = { src: string; thumb: string; width?: number | null; height?: number | null };

/** Swipeable photo gallery (scroll-snap on phones, thumbnails on desktop). */
export function ListingGallery({ images, alt }: { images: GalleryImage[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-3xl bg-muted text-muted-foreground">
        <ImageOff className="size-10" />
      </div>
    );
  }

  const goTo = (i: number) => {
    const el = track.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="space-y-3">
      <div className="relative -mx-4 md:mx-0">
        <div
          ref={track}
          onScroll={(e) => {
            const el = e.currentTarget;
            setIndex(Math.round(el.scrollLeft / el.clientWidth));
          }}
          className="flex aspect-square snap-x snap-mandatory overflow-x-auto bg-muted [scrollbar-width:none] md:rounded-3xl"
        >
          {images.map((img, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- photos are pre-resized on upload
            <img
              key={img.src}
              src={img.src}
              alt={i === 0 ? alt : `${alt} — foto ${i + 1}`}
              loading={i === 0 ? "eager" : "lazy"}
              className="size-full shrink-0 snap-center object-contain"
            />
          ))}
        </div>
        {images.length > 1 && (
          <span className="absolute bottom-3 right-3 rounded-full bg-foreground/70 px-2.5 py-1 text-xs font-bold text-background">
            {index + 1} / {images.length}
          </span>
        )}
      </div>

      {images.length > 1 && (
        <div className="hidden gap-2 md:flex">
          {images.map((img, i) => (
            <button
              key={img.thumb}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Ver foto ${i + 1}`}
              className={cn(
                "size-16 overflow-hidden rounded-xl border-2",
                i === index ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.thumb} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
