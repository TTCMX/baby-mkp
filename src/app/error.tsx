"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <h1 className="text-2xl font-extrabold">Algo salió mal</h1>
      <p className="mt-2 text-muted-foreground">No pudimos cargar esta página. Intenta de nuevo en un momento.</p>
      <Button className="mt-6" onClick={reset}>
        Reintentar
      </Button>
    </div>
  );
}
