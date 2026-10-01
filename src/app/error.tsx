"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <h1 className="text-2xl font-extrabold">Algo salió mal</h1>
      <p className="mt-2 text-muted-foreground">No pudimos cargar esta página. Intenta de nuevo en un momento.</p>
      {/* retry() re-fetches the server data; reset() would only re-render the same failure. */}
      <Button className="mt-6" onClick={() => retry()}>
        Reintentar
      </Button>
    </div>
  );
}
