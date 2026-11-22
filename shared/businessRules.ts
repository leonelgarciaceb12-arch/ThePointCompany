export type ExpenseClassification = {
  category: string;
  type: string;
  description: string;
  isAdvertising: boolean;
};

/**
 * Publicidad manual siempre se representa como Publicidad / Meta Ads.
 * Los honorarios de un publicista se mantienen como gasto operativo separado.
 */
export function classifyExpense(input: {
  category?: string | null;
  type?: string | null;
  description?: string | null;
  platform?: string | null;
}): ExpenseClassification {
  const category = String(input.category ?? "").trim();
  const type = String(input.type ?? "").trim();
  const description = String(input.description ?? "").trim();
  const platform = String(input.platform ?? "").trim();
  const publicistFee = category.toLocaleLowerCase("es-AR").includes("publicista");
  const searchable = `${category} ${type} ${description} ${platform}`.toLocaleLowerCase("es-AR");
  const isAdvertising = !publicistFee && (
    searchable.includes("publicidad") ||
    searchable.includes("meta ads") ||
    searchable.includes("rdads") ||
    type.toLocaleLowerCase("es-AR") === "publicitario"
  );
  if (isAdvertising) {
    return { category: "Publicidad", type: "Meta Ads", description: "Publicidad", isAdvertising: true };
  }
  return {
    category: category || "Operativo",
    type: type || "Operativo",
    description: description || "Gasto",
    isAdvertising: false,
  };
}

export function isAdvertisingExpense(input: {
  category?: string | null;
  type?: string | null;
  description?: string | null;
  platform?: string | null;
}) {
  return classifyExpense(input).isAdvertising;
}
