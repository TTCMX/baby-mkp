"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type WizardPhoto = {
  key: string;
  /** Storage path once uploaded. */
  path?: string;
  previewUrl: string;
  status: "uploading" | "done" | "error";
  width: number | null;
  height: number | null;
  /** Already attached to the saved listing (deleted server-side on save, not immediately). */
  saved: boolean;
};

type Props = {
  photos: WizardPhoto[];
  maxImages: number;
  onAdd: (files: File[]) => void;
  onRemove: (key: string) => void;
  onMove: (key: string, to: number) => void;
  error?: string;
};

export function PhotosStep({ photos, maxImages, onAdd, onRemove, onMove, error }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const remaining = maxImages - photos.length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-extrabold">Sube tus fotos</h2>
        <p className="text-sm text-muted-foreground">
          Buena luz y fondo limpio venden más. La primera foto es la principal. Hasta {maxImages} fotos.
        </p>
      </div>

      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((photo, i) => (
          <li key={photo.key} className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.previewUrl} alt={`Foto ${i + 1}`} className="size-full object-cover" />

            {photo.status === "uploading" && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                <Loader2 className="size-6 animate-spin text-primary" aria-label="Subiendo" />
              </div>
            )}
            {photo.status === "error" && (
              <div className="absolute inset-0 flex items-center justify-center bg-destructive/80 p-2 text-center text-xs font-bold text-white">
                No se pudo subir
              </div>
            )}

            {i === 0 ? (
              <span className="absolute left-1.5 top-1.5 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                Principal
              </span>
            ) : (
              <IconButton
                label="Hacer principal"
                className="absolute left-1.5 top-1.5"
                onClick={() => onMove(photo.key, 0)}
              >
                <Star />
              </IconButton>
            )}
            <IconButton label="Quitar foto" className="absolute right-1.5 top-1.5" onClick={() => onRemove(photo.key)}>
              <X />
            </IconButton>

            <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between">
              <IconButton label="Mover a la izquierda" disabled={i === 0} onClick={() => onMove(photo.key, i - 1)}>
                <ChevronLeft />
              </IconButton>
              <IconButton
                label="Mover a la derecha"
                disabled={i === photos.length - 1}
                onClick={() => onMove(photo.key, i + 1)}
              >
                <ChevronRight />
              </IconButton>
            </div>
          </li>
        ))}

        {remaining > 0 && (
          <li>
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-primary/40 bg-card text-sm font-bold text-primary hover:bg-secondary"
            >
              <ImagePlus className="size-7" />
              {photos.length === 0 ? "Agregar fotos" : "Agregar"}
            </button>
          </li>
        )}
      </ul>

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []).slice(0, remaining);
          if (files.length) onAdd(files);
          e.target.value = "";
        }}
      />

      {error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function IconButton({ label, className, children, ...props }: { label: string } & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm disabled:invisible [&_svg]:size-4",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
