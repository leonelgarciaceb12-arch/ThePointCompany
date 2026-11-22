import { describe, expect, it } from "vitest";
import { classifyExpense } from "../shared/businessRules";

describe("clasificación de gastos", () => {
  it("fuerza Meta Ads para publicidad", () => {
    expect(classifyExpense({ category: "Publicidad", type: "Publicitario", description: "Meta Ads" })).toEqual({ category: "Publicidad", type: "Meta Ads", description: "Publicidad", isAdvertising: true });
  });
  it("no mezcla honorarios de Publicista con Meta Ads", () => {
    const result = classifyExpense({ category: "Publicista", type: "Operativo", description: "Asesoría y gestión" });
    expect(result.isAdvertising).toBe(false);
    expect(result.category).toBe("Publicista");
    expect(result.type).toBe("Operativo");
  });
  it("es idempotente", () => {
    const once = classifyExpense({ category: "Publicidad", type: "Meta Ads", description: "Publicidad" });
    const twice = classifyExpense(once);
    expect(twice).toEqual(once);
  });
});
