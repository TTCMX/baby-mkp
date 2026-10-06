"use client";

import { useEffect } from "react";
import "./globals.css";

/** Last-resort boundary when the root layout itself fails: renders its own <html>. */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es-MX">
      <body className="flex min-h-dvh items-center justify-center bg-background p-6 font-sans text-foreground">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-extrabold">Algo salió mal</h1>
          <p className="mt-2 text-muted-foreground">Estamos teniendo problemas. Intenta de nuevo en un momento.</p>
          <button
            onClick={() => retry()}
            className="mt-6 h-11 rounded-full bg-primary px-6 font-extrabold text-primary-foreground"
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
