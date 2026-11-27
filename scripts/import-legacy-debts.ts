import "dotenv/config";
import { readFile } from "node:fs/promises";
import { eq, and } from "drizzle-orm";
import { getDb } from "../server/db";
import { loans } from "../drizzle/schema";

type LegacyDebt = {
  counterparty: string;
  description: string;
  principal: number;
  paid: number;
  balance: number;
  currency: string;
  startDate: string;
  dueDate: string;
};

const path = process.argv[2] || ".private/legacy-debts.json";
const debts = JSON.parse(await readFile(path, "utf8")) as LegacyDebt[];
const db = await getDb();
if (!db) throw new Error("Database is not available");

for (const debt of debts) {
  const existing = (await db.select({ id: loans.id }).from(loans).where(and(
    eq(loans.counterparty, debt.counterparty),
    eq(loans.description, debt.description),
  )).limit(1))[0];
  if (existing) {
    console.log(`Ya existe: ${debt.counterparty}`);
    continue;
  }
  await db.insert(loans).values({
    kind: "loan",
    counterparty: debt.counterparty,
    description: debt.description,
    currency: debt.currency,
    principal: debt.principal.toFixed(2),
    repaymentAmount: debt.principal.toFixed(2),
    paid: debt.paid.toFixed(2),
    balance: debt.balance.toFixed(2),
    interestRate: "0.00",
    interestUnit: "percent",
    interestPeriod: "monthly",
    interestBase: "initial_principal",
    installmentCount: null,
    installmentAmount: null,
    installmentPeriod: "weekly",
    hasDueDate: true,
    startDate: debt.startDate,
    dueDate: debt.dueDate,
    status: debt.balance > 0 ? "overdue" : "paid",
    notes: "Registro histórico conservado a pedido del propietario.",
  });
  console.log(`Importada: ${debt.counterparty}`);
}
