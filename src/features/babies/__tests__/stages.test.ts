import { describe, expect, it } from "vitest";
import {
  ageLabel,
  currentStage,
  daysUntilNextStage,
  headline,
  nextStage,
  outgrownStage,
  timeline,
  todayInMexico,
} from "@/features/babies/stages";

const TODAY = "2026-09-24";
const born = (birth_date: string) => ({ birth_date, due_date: null });
const due = (due_date: string) => ({ birth_date: null, due_date });

describe("calendar helpers", () => {
  it("adds months and counts whole months", async () => {
    const { addMonths, completedMonths } = await import("@/features/babies/stages");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2025-09-24", 12)).toBe("2026-09-24");
    expect(completedMonths("2025-09-24", "2026-09-24")).toBe(12);
    expect(completedMonths("2025-09-25", "2026-09-24")).toBe(11);
    expect(completedMonths("2026-01-31", "2026-02-28")).toBe(1);
  });
});

describe("stages", () => {
  it("maps age to the catalogue stage", () => {
    expect(currentStage(born("2026-09-20"), TODAY)).toBe("0_3m");
    expect(currentStage(born("2026-05-01"), TODAY)).toBe("3_6m"); // ~4.8 months
    expect(currentStage(born("2026-02-24"), TODAY)).toBe("6_12m"); // 7 months
    expect(currentStage(born("2025-09-24"), TODAY)).toBe("1_2y"); // exactly 1 year
    expect(currentStage(born("2023-09-24"), TODAY)).toBe("2_4y");
    expect(currentStage(born("2021-01-01"), TODAY)).toBe("4y_plus");
    expect(currentStage(due("2027-01-10"), TODAY)).toBe("pregnancy");
    // Due date already passed but birth not recorded yet: treat as newborn
    expect(currentStage(due("2026-09-10"), TODAY)).toBe("0_3m");
  });

  it("builds the timeline with progress on the current stage", () => {
    const t = timeline(born("2026-02-24"), TODAY); // 7 months → 6–12m
    expect(t.map((s) => s.state)).toEqual(["done", "done", "done", "current", "next", "future", "future"]);
    expect(t[3].progress).toBe(17); // 31 of 184 days (Aug 24 → Feb 24)
    const p = timeline(due("2026-12-31"), TODAY); // 98 days left of 280
    expect(p[0]).toMatchObject({ stage: "pregnancy", state: "current", progress: 65 });
    expect(p[1].state).toBe("next");
    const last = timeline(born("2020-01-01"), TODAY).at(-1)!;
    expect(last.state).toBe("current");
    expect(last.progress).toBeUndefined();
  });

  it("finds the outgrown and the next stage", () => {
    expect(outgrownStage(born("2026-02-24"), TODAY)).toBe("3_6m");
    expect(outgrownStage(born("2026-09-01"), TODAY)).toBeNull(); // newborn
    expect(outgrownStage(due("2027-01-01"), TODAY)).toBeNull();
    expect(nextStage(born("2026-02-24"), TODAY)).toBe("1_2y");
    expect(nextStage(born("2020-01-01"), TODAY)).toBeNull();
  });

  it("counts days to the next stage", () => {
    expect(daysUntilNextStage(born("2025-10-01"), TODAY)).toBe(7); // turns 1 on Oct 1
    expect(daysUntilNextStage(due("2026-10-24"), TODAY)).toBe(30);
    expect(daysUntilNextStage(born("2020-01-01"), TODAY)).toBeNull();
  });

  it("formats ages in Spanish", () => {
    expect(ageLabel(born("2026-09-24"), TODAY)).toBe("Recién nacido");
    expect(ageLabel(born("2026-09-10"), TODAY)).toBe("14 días");
    expect(ageLabel(born("2026-08-20"), TODAY)).toBe("1 mes");
    expect(ageLabel(born("2026-02-24"), TODAY)).toBe("7 meses");
    expect(ageLabel(born("2025-06-20"), TODAY)).toBe("1 año y 3 meses");
    expect(ageLabel(born("2024-09-20"), TODAY)).toBe("2 años");
    expect(ageLabel(due("2026-12-31"), TODAY)).toBe("Semana 26 de embarazo");
  });

  it("writes a friendly headline", () => {
    expect(headline("Emilia", born("2026-02-24"), TODAY)).toBe("Emilia está en 6–12 meses");
    expect(headline("Mateo", born("2025-10-01"), TODAY)).toBe("Mateo pasa a 1–2 años esta semana");
    expect(headline("Mateo", born("2025-10-15"), TODAY)).toBe("Mateo pasa a 1–2 años en 3 semanas");
    expect(headline("Bebé", due("2026-11-01"), TODAY)).toBe("¡Ya casi llega Bebé! Prepárate para sus primeros meses");
  });

  it("uses Mexico City's calendar day", () => {
    expect(todayInMexico(new Date("2026-09-25T03:00:00Z"))).toBe("2026-09-24"); // 21:00 in CDMX
  });
});
