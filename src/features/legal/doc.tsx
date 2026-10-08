import type { ReactNode } from "react";

// Building blocks for long-form pages (Terms, Privacy, Help).

export function Doc({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl space-y-5 pb-6 text-[15px] leading-relaxed [&_a]:font-semibold [&_a]:text-primary">
      <header className="space-y-1">
        <h1 className="text-[28px] font-semibold leading-tight md:text-[34px]">{title}</h1>
        {updated && <p className="text-sm text-muted-foreground">Última actualización: {updated}</p>}
      </header>
      {children}
    </article>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="pt-3 text-xl font-semibold">{children}</h2>;
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5">{children}</ul>;
}

/** A value the admin hasn't filled in yet (Admin → Ajustes → Datos legales). */
export function Setting({ value, missing = "por definir" }: { value: string; missing?: string }) {
  return value ? <>{value}</> : <span className="rounded bg-sun-wash px-1 font-semibold">[{missing}]</span>;
}
