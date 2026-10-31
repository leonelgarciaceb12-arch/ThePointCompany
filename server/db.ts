import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  adCampaigns,
  backupSchedules,
  backupSnapshots,
  customers,
  editorProposals,
  expenses,
  loans,
  objectives,
  products,
  receivables,
  saleItems,
  sales,
  stockMovements,
  InsertUser,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let seedPromise: Promise<void> | null = null;
let lastDollarRates: Array<{
  moneda: string;
  casa: string;
  nombre: string;
  compra: number;
  venta: number;
  fechaActualizacion: string;
}> = [];
let lastUsdtRate: {
  symbol: string;
  price: number;
  source: string;
  fetchedAt: string;
} | null = null;

const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires";
const dateKeyInTimeZone = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ARGENTINA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};
const shiftDateKey = (dateKey: string, days: number) => {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

function debtStatus(
  principal: unknown,
  paid: unknown,
  balance: unknown,
  dueDate?: unknown
): "open" | "partial" | "paid" | "overdue" {
  const remaining = Number(balance ?? 0);
  const settled = Number(paid ?? 0);
  if (
    remaining <= 0 ||
    (Number(principal ?? 0) > 0 && settled >= Number(principal))
  )
    return "paid";
  const due = dueDate ? String(dueDate).slice(0, 10) : "";
  if (due && due < dateKeyInTimeZone()) return "overdue";
  return settled > 0 ? "partial" : "open";
}

function completedInterestPeriods(startDate: unknown, interestPeriod: unknown) {
  const start = String(startDate ?? "").slice(0, 10);
  if (!start) return 0;
  const startAt = new Date(`${start}T00:00:00Z`);
  if (Number.isNaN(startAt.getTime())) return 0;
  const now = new Date();
  if (interestPeriod === "daily")
    return Math.max(
      0,
      Math.floor(
        (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
          startAt.getTime()) /
          86400000
      )
    );
  if (interestPeriod === "weekly")
    return Math.max(
      0,
      Math.floor(
        (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
          startAt.getTime()) /
          (7 * 86400000)
      )
    );
  const months =
    (now.getUTCFullYear() - startAt.getUTCFullYear()) * 12 +
    now.getUTCMonth() -
    startAt.getUTCMonth();
  return Math.max(
    0,
    months - (now.getUTCDate() < startAt.getUTCDate() ? 1 : 0)
  );
}

function effectiveLoanAmounts(row: {
  kind?: unknown;
  hasDueDate?: unknown;
  startDate?: unknown;
  interestRate?: unknown;
  interestUnit?: unknown;
  interestPeriod?: unknown;
  principal: unknown;
  repaymentAmount?: unknown;
  paid: unknown;
}) {
  const base = Number(row.repaymentAmount ?? row.principal);
  const capitalizes =
    (row.kind === "loan" || row.kind === "payable_merch") &&
    row.hasDueDate === false &&
    Number(row.interestRate ?? 0) > 0;
  const periods = capitalizes
    ? completedInterestPeriods(row.startDate, row.interestPeriod)
    : 0;
  const rate = Number(row.interestRate ?? 0);
  const totalDue = capitalizes
    ? row.interestUnit === "usd"
      ? base + rate * periods
      : base * Math.pow(1 + rate / 100, periods)
    : base;
  const paid = Number(row.paid ?? 0);
  return {
    totalDue,
    paid,
    balance: Math.max(0, totalDue - paid),
    periods,
    capitalizes,
  };
}

function presentDebt<
  T extends {
    principal: unknown;
    paid: unknown;
    balance: unknown;
    dueDate?: unknown;
  },
>(row: T) {
  const amounts = effectiveLoanAmounts(
    row as T & {
      kind?: unknown;
      hasDueDate?: unknown;
      startDate?: unknown;
      interestRate?: unknown;
      interestUnit?: unknown;
      interestPeriod?: unknown;
      repaymentAmount?: unknown;
    }
  );
  return {
    ...row,
    repaymentAmount: amounts.totalDue.toFixed(2),
    balance: amounts.balance.toFixed(2),
    status: debtStatus(
      amounts.totalDue,
      amounts.paid,
      amounts.balance,
      row.dueDate
    ),
    interestPeriods: amounts.periods,
    interestCapitalized: amounts.capitalizes,
  };
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  values.lastSignedIn ??= new Date();
  updateSet.lastSignedIn ??= new Date();
  await db
    .insert(users)
    .values(values)
    .onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result[0];
}

const here = dirname(fileURLToPath(import.meta.url));
const seedPath = join(here, "..", "data", "seed-normalized.json");

function parseSeedDate(value: string | null | undefined) {
  return value ? value.slice(0, 10) : null;
}

function toMoney(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function normalizeIdentity(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("es-AR");
}
function normalizePhone(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}
const historicalUnknownCustomer = "periodo antes del seguimiento de clientes";
async function syncCustomersFromSales(db: any) {
  const allCustomers = await db.select().from(customers);
  const allSales = await db
    .select()
    .from(sales)
    .where(sql`${sales.customerName} is not null`);
  const touched = new Set<number>();
  for (const sale of allSales) {
    const name = String(sale.customerName || "").trim();
    if (!name || normalizeIdentity(name).startsWith(historicalUnknownCustomer))
      continue;
    const phoneKey = normalizePhone(sale.customerPhone);
    const nameKey = normalizeIdentity(name);
    let customer = phoneKey
      ? allCustomers.find(
          (item: any) => normalizePhone(item.phone) === phoneKey
        )
      : undefined;
    customer ||= allCustomers.find(
      (item: any) => normalizeIdentity(item.name) === nameKey
    );
    if (!customer) {
      const created = await db.insert(customers).values({
        name,
        phone: sale.customerPhone || null,
        purchases: 0,
        spent: "0.00",
        profit: "0.00",
        firstPurchase: null,
        lastPurchase: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      customer = {
        id: Number(created[0].insertId),
        name,
        phone: sale.customerPhone || null,
      };
      allCustomers.push(customer);
    } else if (!customer.phone && sale.customerPhone) {
      await db
        .update(customers)
        .set({ phone: sale.customerPhone, updatedAt: new Date() })
        .where(eq(customers.id, customer.id));
      customer.phone = sale.customerPhone;
    }
    touched.add(Number(customer.id));
    if (sale.customerId !== customer.id)
      await db
        .update(sales)
        .set({ customerId: customer.id })
        .where(eq(sales.id, sale.id));
  }
  for (const customerId of touched) await refreshCustomerStats(db, customerId);
}
export async function ensureSeeded() {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    const db = await getDb();
    if (!db) return;
    const raw = JSON.parse(await readFile(seedPath, "utf8")) as {
      products: Array<Record<string, unknown>>;
      sales: Array<Record<string, unknown>>;
      customers: Array<Record<string, unknown>>;
      ads: Array<Record<string, unknown>>;
      expenses: Array<Record<string, unknown>>;
      loans: Array<Record<string, unknown>>;
      objectives: Array<Record<string, unknown>>;
    };
    const now = new Date();
    const count = async (table: any) =>
      Number(
        (await db.select({ count: sql<number>`count(*)` }).from(table))[0]
          ?.count ?? 0
      );
    if ((await count(products)) === 0 && raw.products.length) {
      await db.insert(products).values(
        raw.products.map(p => ({
          legacyId: Number(p.legacyId) || null,
          name: String(p.name),
          category: String(p.category || "Sin categoría"),
          supplier: String(p.supplier || "Propio"),
          stock: Number(p.stock || 0),
          cost: toMoney(p.cost),
          minStock: Number(p.minStock || 3),
          createdAt: now,
          updatedAt: now,
        }))
      );
    }
    if ((await count(customers)) === 0 && raw.customers.length) {
      await db.insert(customers).values(
        raw.customers.map(c => ({
          name: String(c.name),
          phone: c.phone ? String(c.phone) : null,
          purchases: Number(c.purchases || 0),
          spent: toMoney(c.spent),
          profit: "0.00",
          firstPurchase: parseSeedDate(c.firstPurchase as string),
          lastPurchase: parseSeedDate(c.lastPurchase as string),
          createdAt: now,
          updatedAt: now,
        }))
      );
    }
    const customerRows = await db
      .select({ id: customers.id, name: customers.name })
      .from(customers);
    const customerMap = new Map(customerRows.map(c => [c.name, c.id]));
    for (const s of raw.sales) {
      const legacyId = Number(s.legacyId) || null;
      let existing = legacyId
        ? (
            await db
              .select({ id: sales.id })
              .from(sales)
              .where(eq(sales.legacyId, legacyId))
              .limit(1)
          )[0]
        : undefined;
      const total = Number(s.total || 0);
      const profit = Number(s.profit || 0);
      const cost = Math.max(0, total - profit);
      let saleId: number;
      if (existing) saleId = existing.id;
      else {
        const inserted = await db.insert(sales).values({
          legacyId,
          saleDate: parseSeedDate(s.date as string) || "2026-01-01",
          customerId: s.customer
            ? (customerMap.get(String(s.customer)) ?? null)
            : null,
          customerName: s.customer ? String(s.customer) : null,
          customerPhone: s.phone ? String(s.phone) : null,
          channel: String(s.channel || "WhatsApp"),
          total: toMoney(total),
          totalCost: toMoney(cost),
          profit: toMoney(profit),
          margin: total ? toMoney((profit / total) * 100) : "0.00",
          createdAt: now,
          updatedAt: now,
        });
        saleId = Number(inserted[0].insertId);
      }
      const itemExists = (
        await db
          .select({ id: saleItems.id })
          .from(saleItems)
          .where(eq(saleItems.saleId, saleId))
          .limit(1)
      )[0];
      if (s.description)
        await db
          .update(sales)
          .set({ notes: String(s.description) })
          .where(and(eq(sales.id, saleId), sql`${sales.notes} is null`));
      if (!itemExists)
        await db.insert(saleItems).values({
          saleId,
          description: String(s.description),
          quantity: 1,
          unitPrice: toMoney(total),
          unitCost: toMoney(cost),
          total: toMoney(total),
          costTotal: toMoney(cost),
          profit: toMoney(profit),
          fromInventory: false,
          createdAt: now,
          updatedAt: now,
        });
    }
    // Reconcile the historical Ads ledger on every startup. This is intentionally
    // idempotent: it restores deleted seed rows without duplicating rows that are
    // already present in the shared production database.
    for (const a of raw.ads) {
      const adDate = parseSeedDate(a.date as string) || "2026-01-01";
      const platform = String(a.platform || "Meta Ads");
      const amount = toMoney(a.amount);
      const existing = (await db
        .select({ id: adCampaigns.id })
        .from(adCampaigns)
        .where(and(
          eq(adCampaigns.adDate, adDate),
          eq(adCampaigns.platform, platform),
          eq(adCampaigns.amount, amount),
        ))
        .limit(1))[0];
      if (existing) {
        await db.update(adCampaigns).set({
          campaign: "Campaña inicial propia de ventas - Multiples estilos",
          notes: a.notes ? String(a.notes) : null,
          updatedAt: now,
        }).where(eq(adCampaigns.id, existing.id));
      } else {
        await db.insert(adCampaigns).values({
          adDate,
          platform,
          campaign: "Campaña inicial propia de ventas - Multiples estilos",
          amount,
          notes: a.notes ? String(a.notes) : null,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    await db
      .update(adCampaigns)
      .set({ campaign: "Campaña inicial propia de ventas - Multiples estilos" })
      .where(
        sql`${adCampaigns.campaign} like '%estilo folleto%' or ${adCampaigns.campaign} like '%Campaña de venta de vapes%'`
      );
    if ((await count(expenses)) === 0 && raw.expenses.length)
      await db.insert(expenses).values(
        raw.expenses.map(e => ({
          expenseDate: parseSeedDate(e.date as string) || "2026-01-01",
          category: String(e.category || "General"),
          description: String(e.description || "Gasto"),
          amount: toMoney(e.amount),
          type: String(e.type || "Operativo"),
          notes: e.notes ? String(e.notes) : null,
          createdAt: now,
          updatedAt: now,
        }))
      );
    if ((await count(loans)) === 0 && raw.loans.length)
      await db.insert(loans).values(
        raw.loans.map(l => ({
          kind: "loan" as const,
          counterparty: String(l.counterparty),
          description: l.notes ? String(l.notes) : null,
          currency: String(l.currency || "USD"),
          principal: toMoney(l.principal),
          paid: toMoney(l.paid),
          balance: toMoney(l.balance),
          startDate: parseSeedDate(l.startDate as string),
          dueDate: parseSeedDate(l.dueDate as string),
          status:
            Number(l.balance || 0) <= 0 ? ("paid" as const) : ("open" as const),
          notes: l.notes ? String(l.notes) : null,
          createdAt: now,
          updatedAt: now,
        }))
      );
    if ((await count(objectives)) === 0 && raw.objectives.length)
      await db.insert(objectives).values(
        raw.objectives.map(o => ({
          month: String(o.month),
          targetOrders: Number(o.targetOrders || 0),
          targetRevenue: toMoney(o.targetRevenue),
          targetProfit: toMoney(o.targetProfit),
          targetNet: toMoney(o.targetNet),
          createdAt: now,
          updatedAt: now,
        }))
      );
    await syncCustomersFromSales(db);
    console.log(
      `[Database] Seed reconciliation complete: ${raw.products.length} products, ${raw.sales.length} historical sales.`
    );
  })().catch(error => {
    seedPromise = null;
    console.error("[Database] Seed failed:", error);
    throw error;
  });
  return seedPromise;
}

export async function getDashboard(from?: string, to?: string) {
  const db = await getDb();
  if (!db) return null;
  await ensureSeeded();
  const salesWhere =
    from && to
      ? and(gte(sales.saleDate, from), lt(sales.saleDate, to))
      : undefined;
  const publicAdWhere = sql`(
    lower(coalesce(${expenses.category}, '')) like '%publicidad%'
    or lower(coalesce(${expenses.type}, '')) like '%publicidad%'
    or lower(coalesce(${expenses.platform}, '')) like '%meta ads%'
  )`;
  const expenseWhere =
    from && to
      ? and(gte(expenses.expenseDate, from), lt(expenses.expenseDate, to), sql`not ${publicAdWhere}`)
      : sql`not ${publicAdWhere}`;
  const manualAdsWhere =
    from && to
      ? and(gte(expenses.expenseDate, from), lt(expenses.expenseDate, to), publicAdWhere)
      : publicAdWhere;
  const adsWhere =
    from && to
      ? and(gte(adCampaigns.adDate, from), lt(adCampaigns.adDate, to))
      : undefined;
  const activeSalesWhere = salesWhere
    ? and(salesWhere, sql`${sales.status} <> 'cancelled'`)
    : sql`${sales.status} <> 'cancelled'`;
  const [
    summary,
    units,
    inventory,
    lowStock,
    topProducts,
    topCustomers,
    recentSales,
    dueLoans,
    expensesTotal,
    adTotal,
    manualAdsTotal,
    receivableBalance,
    daily,
    channelRows,
    periodCustomerRows,
  ] = await Promise.all([
    db
      .select({
        revenue: sql<number>`coalesce(sum(${sales.total}),0)`,
        profit: sql<number>`coalesce(sum(case when ${sales.costKnown} = true then ${sales.profit} else 0 end),0)`,
        cogs: sql<number>`coalesce(sum(case when ${sales.costKnown} = true then ${sales.totalCost} else 0 end),0)`,
        orders: sql<number>`count(*)`,
        incomplete: sql<number>`coalesce(sum(case when ${sales.costKnown} = false then 1 else 0 end),0)`,
      })
      .from(sales)
      .where(activeSalesWhere),
    db
      .select({ units: sql<number>`coalesce(sum(${saleItems.quantity}),0)` })
      .from(saleItems)
      .leftJoin(sales, eq(saleItems.saleId, sales.id))
      .where(activeSalesWhere),
    db
      .select({
        value: sql<number>`coalesce(sum(${products.stock} * ${products.cost}),0)`,
        units: sql<number>`coalesce(sum(${products.stock}),0)`,
      })
      .from(products)
      .where(eq(products.active, true)),
    db
      .select()
      .from(products)
      .where(
        and(
          eq(products.active, true),
          sql`${products.stock} <= ${products.minStock}`
        )
      )
      .orderBy(asc(products.stock))
      .limit(8),
    db
      .select({
        name: products.name,
        category: products.category,
        units: sql<number>`coalesce(sum(${saleItems.quantity}),0)`,
        profit: sql<number>`coalesce(sum(${saleItems.profit}),0)`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .leftJoin(products, eq(saleItems.productId, products.id))
      .where(activeSalesWhere)
      .groupBy(saleItems.productId, products.name, products.category)
      .orderBy(desc(sql`sum(${saleItems.quantity})`))
      .limit(6),
    db
      .select({
        id: customers.id,
        name: customers.name,
        spent: sql<number>`coalesce(sum(${sales.total}),0)`,
        profit: sql<number>`coalesce(sum(${sales.profit}),0)`,
        lastPurchase: sql<string>`max(${sales.saleDate})`,
        purchases: sql<number>`count(*)`,
      })
      .from(sales)
      .innerJoin(customers, eq(sales.customerId, customers.id))
      .where(activeSalesWhere)
      .groupBy(customers.id, customers.name)
      .orderBy(desc(sql`sum(${sales.total})`))
      .limit(6),
    db
      .select()
      .from(sales)
      .where(activeSalesWhere)
      .orderBy(desc(sales.saleDate), desc(sales.id))
      .limit(8),
    db
      .select()
      .from(loans)
      .where(sql`${loans.balance} > 0`)
      .orderBy(asc(loans.dueDate))
      .limit(8),
    db
      .select({ total: sql<number>`coalesce(sum(${expenses.amount}),0)` })
      .from(expenses)
      .where(expenseWhere),
    db
      .select({ total: sql<number>`coalesce(sum(${adCampaigns.amount}),0)` })
      .from(adCampaigns)
      .where(adsWhere),
    db
      .select({ total: sql<number>`coalesce(sum(${expenses.amount}),0)` })
      .from(expenses)
      .where(manualAdsWhere),
    db
      .select({ balance: sql<number>`coalesce(sum(${receivables.balance}),0)` })
      .from(receivables)
      .where(sql`${receivables.balance} > 0`),
    db
      .select({
        day: sales.saleDate,
        revenue: sql<number>`sum(${sales.total})`,
        profit: sql<number>`sum(case when ${sales.costKnown} = true then ${sales.profit} else 0 end)`,
      })
      .from(sales)
      .where(activeSalesWhere)
      .groupBy(sales.saleDate)
      .orderBy(asc(sales.saleDate)),
    db
      .select({
        channel: sales.channel,
        revenue: sql<number>`coalesce(sum(${sales.total}),0)`,
        orders: sql<number>`count(*)`,
      })
      .from(sales)
      .where(activeSalesWhere)
      .groupBy(sales.channel)
      .orderBy(desc(sql`sum(${sales.total})`))
      .limit(8),
    db
      .select({
        customerId: sales.customerId,
        purchases: sql<number>`count(*)`,
      })
      .from(sales)
      .where(and(activeSalesWhere, sql`${sales.customerId} is not null`))
      .groupBy(sales.customerId),
  ]);
  const revenue = Number(summary[0]?.revenue ?? 0);
  const grossProfit = Number(summary[0]?.profit ?? 0);
  const expenseTotal = Number(expensesTotal[0]?.total ?? 0);
  const adSpend = Number(adTotal[0]?.total ?? 0) + Number(manualAdsTotal[0]?.total ?? 0);
  const unitsSold = Number(units[0]?.units ?? 0);
  const currentStock = Number(inventory[0]?.units ?? 0);
  const activeCustomers = periodCustomerRows.length;
  const repeatCustomers = periodCustomerRows.filter(
    row => Number(row.purchases) > 1
  ).length;
  const attachedOrders = periodCustomerRows.reduce(
    (sum, row) => sum + Number(row.purchases || 0),
    0
  );
  const periodDays =
    from && to
      ? Math.max(
          1,
          Math.ceil(
            (new Date(`${to}T00:00:00`).getTime() -
              new Date(`${from}T00:00:00`).getTime()) /
              86400000
          )
        )
      : Math.max(1, daily.length || 1);
  const bestDay =
    [...daily].sort(
      (a, b) => Number(b.revenue ?? 0) - Number(a.revenue ?? 0)
    )[0] ?? null;
  const advanced = {
    cogs: Number(summary[0]?.cogs ?? 0),
    netProfit: grossProfit - expenseTotal - adSpend,
    netEstimated: grossProfit - expenseTotal - adSpend,
    grossMargin: revenue ? (grossProfit / revenue) * 100 : 0,
    adShareOfRevenue: revenue ? (adSpend / revenue) * 100 : 0,
    repeatRate: activeCustomers ? (repeatCustomers / activeCustomers) * 100 : 0,
    customerAttachRate: Number(summary[0]?.orders ?? 0)
      ? (attachedOrders / Number(summary[0]?.orders ?? 1)) * 100
      : 0,
    averageDailyRevenue: revenue / periodDays,
    profitPerOrder: Number(summary[0]?.orders ?? 0)
      ? grossProfit / Number(summary[0]?.orders ?? 1)
      : 0,
    sellThrough:
      unitsSold + currentStock
        ? (unitsSold / (unitsSold + currentStock)) * 100
        : 0,
    stockCoverageDays: unitsSold
      ? currentStock / (unitsSold / periodDays)
      : null,
    bestDay,
    topChannel: channelRows[0] ?? null,
    channels: channelRows,
    activeCustomers,
    repeatCustomers,
  };
  return {
    summary: { ...summary[0], units: unitsSold },
    inventory: inventory[0],
    lowStock,
    topProducts,
    topCustomers,
    recentSales,
    dueLoans: dueLoans.map(presentDebt),
    expenses: expensesTotal[0],
    ads: adTotal[0],
    daily,
    advanced,
  };
}

export async function listProducts(search?: string, category?: string) {
  const db = await getDb();
  if (!db) return [];
  await ensureSeeded();
  const filters = [eq(products.active, true)];
  if (category && category !== "Todas")
    filters.push(eq(products.category, category));
  if (search)
    filters.push(
      sql`lower(${products.name}) like ${`%${search.toLowerCase()}%`}`
    );
  return db
    .select()
    .from(products)
    .where(and(...filters))
    .orderBy(asc(products.category), asc(products.name));
}

export async function listProductPerformance() {
  const db = await getDb();
  if (!db) return [];
  await ensureSeeded();
  return db
    .select({
      productId: saleItems.productId,
      name: products.name,
      category: products.category,
      stock: products.stock,
      cost: products.cost,
      units: sql<number>`coalesce(sum(${saleItems.quantity}),0)`,
      revenue: sql<number>`coalesce(sum(${saleItems.total}),0)`,
      profit: sql<number>`coalesce(sum(${saleItems.profit}),0)`,
      lastSale: sql<string>`max(${sales.saleDate})`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .leftJoin(products, eq(saleItems.productId, products.id))
    .where(
      sql`${sales.status} <> 'cancelled' and ${saleItems.productId} is not null`
    )
    .groupBy(
      saleItems.productId,
      products.name,
      products.category,
      products.stock,
      products.cost
    )
    .orderBy(desc(sql`sum(${saleItems.quantity})`))
    .limit(100);
}
export async function listSales(limit?: number) {
  const db = await getDb();
  if (!db) return [];
  await ensureSeeded();
  const query = db
    .select()
    .from(sales)
    .where(sql`${sales.status} <> 'cancelled'`)
    .orderBy(desc(sales.saleDate), desc(sales.id));
  const rows = await (limit ? query.limit(limit) : query);
  if (!rows.length) return rows;
  const itemRows = await db
    .select({
      saleId: saleItems.saleId,
      id: saleItems.id,
      productId: saleItems.productId,
      description: saleItems.description,
      quantity: saleItems.quantity,
      unitPrice: saleItems.unitPrice,
      unitCost: saleItems.unitCost,
      fromInventory: saleItems.fromInventory,
      costKnown: saleItems.costKnown,
    })
    .from(saleItems)
    .where(
      inArray(
        saleItems.saleId,
        rows.map(row => row.id)
      )
    )
    .orderBy(asc(saleItems.id));
  const descriptions = new Map<number, string[]>();
  const itemsBySale = new Map<number, typeof itemRows>();
  for (const item of itemRows) {
    const values = descriptions.get(item.saleId) ?? [];
    const label = `${item.quantity || 1} ${item.description}`.trim();
    if (label && !values.includes(label)) values.push(label);
    descriptions.set(item.saleId, values);
    const items = itemsBySale.get(item.saleId) ?? [];
    items.push(item);
    itemsBySale.set(item.saleId, items);
  }
  return rows.map(row => ({
    ...row,
    // Las ventas históricas conservan el texto original del Excel.
    // Las ventas actuales se reconstruyen desde cantidad + producto.
    notes:
      row.legacyId == null
        ? descriptions.get(row.id)?.join(" · ") || row.notes || null
        : row.notes || descriptions.get(row.id)?.join(" · ") || null,
    items: (itemsBySale.get(row.id) ?? []).map(item => ({
      id: item.id,
      productId: item.productId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice || 0),
      unitCost: Number(item.unitCost || 0),
      fromInventory: Boolean(item.fromInventory),
      costKnown: Boolean(item.costKnown),
    })),
  }));
}
export async function listCustomers() {
  const db = await getDb();
  if (!db) return [];
  await ensureSeeded();
  return db.select().from(customers).orderBy(desc(customers.spent));
}
export async function listExpenses() {
  const db = await getDb();
  if (!db) return [];
  await ensureSeeded();
  const rows = await db
    .select()
    .from(expenses)
    .orderBy(desc(expenses.expenseDate), desc(expenses.id));
  for (const row of rows) {
    if (row.id === 120001 && Number(row.amount || 0) === 280) {
      await db.update(expenses).set({
        category: "Publicista",
        description: "Asesoría y gestión de publicidad",
        type: "Operativo",
      }).where(eq(expenses.id, row.id));
      row.category = "Publicista";
      row.description = "Asesoría y gestión de publicidad";
      row.type = "Operativo";
      continue;
    }
    const searchable = `${row.category || ""} ${row.type || ""} ${row.description || ""} ${row.platform || ""}`.toLocaleLowerCase("es-AR");
    const isPublicistFee = String(row.category || "").toLocaleLowerCase("es-AR").includes("publicista");
    if (!isPublicistFee && (searchable.includes("publicidad") || searchable.includes("meta ads") || searchable.includes("rdads"))) {
      if (row.category !== "Publicidad" || row.type !== "Publicitario" || row.description !== "Publicidad") {
        await db.update(expenses).set({
          category: "Publicidad",
          type: "Publicitario",
          description: "Publicidad",
        }).where(eq(expenses.id, row.id));
        row.category = "Publicidad";
        row.type = "Publicitario";
        row.description = "Publicidad";
      }
    }
  }
  return rows;
}
export async function listLoans() {
  const db = await getDb();
  if (!db) return [];
  await ensureSeeded();
  const historicalSettled = (await db
    .select()
    .from(loans)
    .where(and(eq(loans.counterparty, "Santiago Lopez"), eq(loans.description, "100 Elfbar Ice King 40k puff")))
    .limit(1))[0];
  if (historicalSettled && Number(historicalSettled.balance || 0) > 0) {
    await db.update(loans).set({
      paid: historicalSettled.principal,
      balance: "0.00",
      status: "paid",
      notes: "Compromiso saldado reconstruido desde el registro histórico del negocio.",
    }).where(eq(loans.id, historicalSettled.id));
  } else if (!historicalSettled) {
    await db.insert(loans).values({
      kind: "payable_merch",
      counterparty: "Santiago Lopez",
      description: "100 Elfbar Ice King 40k puff",
      currency: "USD",
      interestRate: "0.00",
      interestPeriod: "monthly",
      principal: "1110.00",
      repaymentAmount: "1110.00",
      hasDueDate: true,
      paid: "1110.00",
      balance: "0.00",
      startDate: "2026-09-30",
      dueDate: "2026-10-10",
      status: "paid",
      notes: "Compromiso saldado reconstruido desde el registro histórico del negocio.",
    });
  }
  // La mentoría fue un gasto/inversión, no una deuda del negocio: retirarla
  // del historial de compromisos aunque una versión anterior la haya creado.
  await db.delete(loans).where(and(
    eq(loans.counterparty, "Mateo Portillo"),
    eq(loans.description, "Mentoria 1:1 por 3 meses"),
  ));
  const userSettled = [
    { counterparty: "Lautaro Mires", description: "57 Battery Pack 10.000 mAh", principal: "357.57", startDate: "2026-10-12", dueDate: "2026-10-22" },
    { counterparty: "Bautista Restifo", description: "100 Termitos c/sensor de temperatura", principal: "400.00", startDate: "2026-10-02", dueDate: "2026-10-12" },
    { counterparty: "Mateo Portillo", description: "50 Vasos quencher Stanley", principal: "400.00", startDate: "2026-10-02", dueDate: "2026-10-12" },
    { counterparty: "Mateo Portillo", description: "100 Body Splash Victoria's Secret (réplica)", principal: "700.00", startDate: "2026-10-09", dueDate: "2026-10-19" },
  ];
  for (const item of userSettled) {
    const existing = (await db.select({ id: loans.id }).from(loans).where(and(
      eq(loans.counterparty, item.counterparty),
      eq(loans.description, item.description),
    )).limit(1))[0];
    if (!existing) await db.insert(loans).values({
      kind: "payable_merch",
      counterparty: item.counterparty,
      description: item.description,
      currency: "USD",
      interestRate: "0.00",
      interestPeriod: "monthly",
      principal: item.principal,
      repaymentAmount: item.principal,
      hasDueDate: true,
      paid: item.principal,
      balance: "0.00",
      startDate: item.startDate,
      dueDate: item.dueDate,
      status: "paid",
      notes: "Compromiso informado como saldado por el usuario el 27/10/2026.",
    });
  }
  const rows = await db.select().from(loans).orderBy(asc(loans.dueDate));
  return rows.map(presentDebt);
}
export async function listAds() {
  const db = await getDb();
  if (!db) return [];
  await ensureSeeded();
  return db
    .select()
    .from(adCampaigns)
    .orderBy(desc(adCampaigns.adDate), desc(adCampaigns.id))
    .limit(100);
}

export async function getAdsSpendHistory() {
  const db = await getDb();
  if (!db) return { manual: [], daily: [] };
  await ensureSeeded();
  const monthKey = sql<string>`date_format(${adCampaigns.adDate}, '%Y-%m')`;
  const campaignManual = await db
    .select({
      month: monthKey,
      spend: sql<number>`coalesce(sum(${adCampaigns.amount}), 0)`,
      entries: sql<number>`count(*)`,
    })
    .from(adCampaigns)
    .groupBy(monthKey)
    .orderBy(monthKey);
  const expenseManual = await db
    .select({
      id: expenses.id,
      date: expenses.expenseDate,
      category: expenses.category,
      type: expenses.type,
      platform: expenses.platform,
      amount: expenses.amount,
    })
    .from(expenses);
  const campaignEntries = await db
    .select({ date: adCampaigns.adDate, amount: adCampaigns.amount })
    .from(adCampaigns);
  const manualByMonth = new Map<string, { spend: number; entries: number }>();
  const manualByDay = new Map<string, { spend: number; entries: number }>();
  const addDaily = (date: unknown, amount: unknown) => {
    const key = String(date).slice(0, 10);
    const current = manualByDay.get(key) || { spend: 0, entries: 0 };
    current.spend += Number(amount || 0);
    current.entries += 1;
    manualByDay.set(key, current);
  };
  for (const row of campaignEntries) addDaily(row.date, row.amount);
  for (const row of campaignManual) {
    const key = String(row.month);
    manualByMonth.set(key, {
      spend: Number(row.spend || 0),
      entries: Number(row.entries || 0),
    });
  }
  for (const row of expenseManual) {
    if (row.id === 120001 && Number(row.amount || 0) === 280) continue;
    const searchable = `${row.category || ""} ${row.type || ""} ${row.platform || ""}`.toLocaleLowerCase("es-AR");
    if (!searchable.includes("publicidad") && !searchable.includes("meta ads")) continue;
    const key = String(row.date).slice(0, 7);
    const current = manualByMonth.get(key) || { spend: 0, entries: 0 };
    current.spend += Number(row.amount || 0);
    current.entries += 1;
    manualByMonth.set(key, current);
    addDaily(row.date, row.amount);
  }
  return {
    manual: [...manualByMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, row]) => ({
      month,
      spend: row.spend,
      entries: row.entries,
    })),
    daily: [...manualByDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, row]) => ({
      date,
      spend: row.spend,
      entries: row.entries,
    })),
  };
}

export async function listEditorProposals() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(editorProposals).orderBy(desc(editorProposals.createdAt)).limit(50);
}

export async function createEditorProposal(input: {
  title: string;
  filePath: string;
  patch: string;
  submittedBy?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(editorProposals).values({
    title: input.title,
    filePath: input.filePath,
    patch: input.patch,
    submittedBy: input.submittedBy || "Editor restringido",
    status: "proposed",
  });
  return Number(result[0].insertId);
}

export async function listObjectives() {
  const db = await getDb();
  if (!db) return [];
  await ensureSeeded();
  return db.select().from(objectives).orderBy(asc(objectives.id));
}
export async function listReceivables() {
  const db = await getDb();
  if (!db) return [];
  await ensureSeeded();
  const rows = await db
    .select()
    .from(receivables)
    .where(sql`${receivables.balance} > 0`)
    .orderBy(asc(receivables.dueDate));
  return rows.map(presentDebt);
}

export async function createProduct(input: {
  name: string;
  category: string;
  supplier?: string;
  stock: number;
  cost: number;
  minStock?: number;
  userId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(products).values({
    name: input.name,
    category: input.category,
    supplier: input.supplier || "Propio",
    stock: input.stock,
    cost: toMoney(input.cost),
    minStock: input.minStock ?? 3,
    createdBy: input.userId,
    updatedBy: input.userId,
  });
  return Number(result[0].insertId);
}

export async function updateProduct(
  id: number,
  input: {
    name: string;
    category: string;
    supplier?: string;
    stock: number;
    cost: number;
    minStock?: number;
    userId?: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async tx => {
    const current = (
      await tx.select().from(products).where(eq(products.id, id)).limit(1)
    )[0];
    if (!current) throw new Error("Producto no encontrado");
    await tx
      .update(products)
      .set({
        name: input.name,
        category: input.category,
        supplier: input.supplier || "Propio",
        stock: input.stock,
        cost: toMoney(input.cost),
        minStock: input.minStock ?? 3,
        updatedBy: input.userId,
      })
      .where(eq(products.id, id));
    if (current.stock !== input.stock)
      await tx.insert(stockMovements).values({
        productId: id,
        type: "adjustment",
        quantity: input.stock - current.stock,
        unitCost: toMoney(input.cost),
        notes: "Ajuste desde edición del producto",
        createdBy: input.userId,
        updatedBy: input.userId,
      });
    return { id };
  });
}

export async function deleteProduct(id: number, userId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async tx => {
    const saleLink = await tx
      .select({ id: saleItems.id })
      .from(saleItems)
      .where(eq(saleItems.productId, id))
      .limit(1);
    const movementLink = await tx
      .select({ id: stockMovements.id })
      .from(stockMovements)
      .where(eq(stockMovements.productId, id))
      .limit(1);
    if (saleLink.length || movementLink.length) {
      await tx
        .update(products)
        .set({ active: false, updatedBy: userId })
        .where(eq(products.id, id));
      return { archived: true };
    }
    await tx.delete(products).where(eq(products.id, id));
    return { archived: false };
  });
}

async function refreshCustomerStats(
  tx: any,
  customerId: number | null | undefined
) {
  if (!customerId) return;
  const rows = await tx
    .select({
      purchases: sql<number>`count(*)`,
      spent: sql<number>`coalesce(sum(${sales.total}),0)`,
      profit: sql<number>`coalesce(sum(${sales.profit}),0)`,
      firstPurchase: sql<string>`min(${sales.saleDate})`,
      lastPurchase: sql<string>`max(${sales.saleDate})`,
    })
    .from(sales)
    .where(and(eq(sales.customerId, customerId), eq(sales.status, "paid")));
  const row = rows[0];
  await tx
    .update(customers)
    .set({
      purchases: Number(row?.purchases ?? 0),
      spent: toMoney(row?.spent),
      profit: toMoney(row?.profit),
      firstPurchase: row?.firstPurchase || null,
      lastPurchase: row?.lastPurchase || null,
    })
    .where(eq(customers.id, customerId));
}

export async function updateSale(
  id: number,
  input: {
    date: string;
    customerId?: number | null;
    customerName?: string;
    customerPhone?: string;
    channel?: string;
    total: number;
    totalCost: number;
    costKnown?: boolean;
    description?: string;
    notes?: string;
    status?: "paid" | "pending";
    items?: Array<{
      productId?: number;
      description: string;
      quantity: number;
      unitPrice: number;
      unitCost?: number;
      fromInventory?: boolean;
      supplier?: string;
    }>;
    userId?: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async tx => {
    const current = (await tx.select().from(sales).where(eq(sales.id, id)).limit(1))[0];
    if (!current) throw new Error("Venta no encontrada");
    const oldCustomerId = current.customerId;
    const costKnown = input.costKnown !== false;
    const replacementItems = input.items?.length
      ? input.items.map(item => ({
          ...item,
          quantity: Math.max(1, Math.trunc(item.quantity)),
          unitPrice: Math.max(0, item.unitPrice),
          unitCost: Math.max(0, item.unitCost ?? 0),
          fromInventory: Boolean(item.fromInventory && item.productId),
        }))
      : null;
    let finalTotal = input.total;
    let finalCost = costKnown ? input.totalCost : 0;
    if (replacementItems) {
      const oldItems = await tx.select().from(saleItems).where(eq(saleItems.saleId, id));
      for (const item of oldItems) {
        if (!item.fromInventory || !item.productId) continue;
        await tx.update(products)
          .set({ stock: sql`${products.stock} + ${item.quantity}`, updatedBy: input.userId })
          .where(eq(products.id, item.productId));
      }
      await tx.delete(stockMovements).where(and(eq(stockMovements.referenceId, id), eq(stockMovements.type, "sale")));
      await tx.delete(saleItems).where(eq(saleItems.saleId, id));
      finalTotal = replacementItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      finalCost = replacementItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
      for (const item of replacementItems) {
        if (item.fromInventory && item.productId) {
          const product = (await tx.select().from(products).where(eq(products.id, item.productId)).limit(1))[0];
          if (!product) throw new Error(`Producto ${item.productId} no encontrado`);
          if (product.stock < item.quantity) throw new Error(`Stock insuficiente para ${product.name}`);
          await tx.update(products)
            .set({ stock: product.stock - item.quantity, updatedBy: input.userId })
            .where(eq(products.id, product.id));
          await tx.insert(stockMovements).values({
            productId: product.id,
            type: "sale",
            quantity: -item.quantity,
            unitCost: toMoney(item.unitCost),
            referenceId: id,
            notes: "Venta editada",
            createdBy: input.userId,
            updatedBy: input.userId,
          });
        }
        await tx.insert(saleItems).values({
          saleId: id,
          productId: item.productId ?? null,
          description: item.description,
          quantity: item.quantity,
          unitPrice: toMoney(item.unitPrice),
          unitCost: toMoney(item.unitCost),
          total: toMoney(item.quantity * item.unitPrice),
          costTotal: toMoney(item.quantity * item.unitCost),
          profit: toMoney(item.quantity * (item.unitPrice - item.unitCost)),
          costKnown,
          fromInventory: item.fromInventory,
          supplier: item.supplier || null,
          createdBy: input.userId,
          updatedBy: input.userId,
        });
      }
    }
    const profit = costKnown ? finalTotal - finalCost : 0;
    await tx.update(sales).set({
      saleDate: input.date,
      customerId: input.customerId ?? null,
      customerName: input.customerName || null,
      customerPhone: input.customerPhone || null,
      channel: input.channel || "WhatsApp",
      total: toMoney(finalTotal),
      totalCost: toMoney(finalCost),
      profit: toMoney(profit),
      margin: costKnown && finalTotal ? toMoney((profit / finalTotal) * 100) : "0.00",
      costKnown,
      status: input.status || current.status,
      notes: input.notes,
      updatedBy: input.userId,
    }).where(eq(sales.id, id));
    if (!replacementItems) {
      const item = (await tx.select().from(saleItems).where(eq(saleItems.saleId, id)).orderBy(asc(saleItems.id)).limit(1))[0];
      if (item) {
        const quantity = Math.max(1, item.quantity);
        await tx.update(saleItems).set({
          description: input.description || item.description,
          unitPrice: toMoney(finalTotal / quantity),
          unitCost: toMoney(costKnown ? finalCost / quantity : 0),
          total: toMoney(finalTotal),
          costTotal: toMoney(finalCost),
          profit: toMoney(profit),
          costKnown,
          updatedBy: input.userId,
        }).where(eq(saleItems.id, item.id));
      }
    }
    await refreshCustomerStats(tx, oldCustomerId);
    await refreshCustomerStats(tx, input.customerId);
    return { id, profit };
  });
}

export async function deleteSale(id: number, userId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async tx => {
    const sale = (
      await tx.select().from(sales).where(eq(sales.id, id)).limit(1)
    )[0];
    if (!sale) throw new Error("Venta no encontrada");
    const items = await tx
      .select()
      .from(saleItems)
      .where(eq(saleItems.saleId, id));
    for (const item of items)
      if (item.fromInventory && item.productId) {
        const product = (
          await tx
            .select()
            .from(products)
            .where(eq(products.id, item.productId))
            .limit(1)
        )[0];
        if (product)
          await tx
            .update(products)
            .set({ stock: product.stock + item.quantity, updatedBy: userId })
            .where(eq(products.id, product.id));
      }
    await tx
      .delete(stockMovements)
      .where(
        and(eq(stockMovements.referenceId, id), eq(stockMovements.type, "sale"))
      );
    await tx.delete(saleItems).where(eq(saleItems.saleId, id));
    await tx.delete(sales).where(eq(sales.id, id));
    await refreshCustomerStats(tx, sale.customerId);
    return { id };
  });
}

export async function updateCustomer(
  id: number,
  input: {
    name: string;
    phone?: string;
    locality?: string;
    notes?: string;
    userId?: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db
    .update(customers)
    .set({
      name: input.name,
      phone: input.phone || null,
      locality: input.locality || null,
      notes: input.notes || null,
      updatedBy: input.userId,
    })
    .where(eq(customers.id, id));
  await db
    .update(sales)
    .set({
      customerName: input.name,
      customerPhone: input.phone || null,
      updatedBy: input.userId,
    })
    .where(eq(sales.customerId, id));
  return { id };
}

export async function deleteCustomer(id: number, userId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db
    .update(sales)
    .set({ customerId: null, updatedBy: userId })
    .where(eq(sales.customerId, id));
  await db.delete(customers).where(eq(customers.id, id));
  return { id };
}

export async function adjustStock(input: {
  productId: number;
  quantity: number;
  type: "purchase" | "adjustment" | "return";
  unitCost?: number;
  notes?: string;
  userId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async tx => {
    const found = await tx
      .select()
      .from(products)
      .where(eq(products.id, input.productId))
      .limit(1);
    const product = found[0];
    if (!product) throw new Error("Producto no encontrado");
    const next = product.stock + input.quantity;
    if (next < 0) throw new Error("El stock no puede quedar negativo");
    await tx
      .update(products)
      .set({
        stock: next,
        ...(input.unitCost !== undefined
          ? { cost: toMoney(input.unitCost) }
          : {}),
        updatedBy: input.userId,
      })
      .where(eq(products.id, input.productId));
    await tx.insert(stockMovements).values({
      productId: input.productId,
      type: input.type,
      quantity: input.quantity,
      unitCost: toMoney(input.unitCost ?? Number(product.cost)),
      notes: input.notes,
      createdBy: input.userId,
      updatedBy: input.userId,
    });
    return { stock: next };
  });
}

export async function createSale(input: {
  date: string;
  channel?: string;
  customerName?: string;
  customerPhone?: string;
  customerId?: number;
  notes?: string;
  paymentStatus?: "paid" | "partial";
  paidAmount?: number;
  items: Array<{
    productId?: number;
    description: string;
    quantity: number;
    unitPrice: number;
    unitCost?: number;
    fromInventory: boolean;
    supplier?: string;
  }>;
  userId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async tx => {
    let total = 0,
      totalCost = 0,
      costKnown = true;
    const prepared: Array<{
      item: (typeof input.items)[number];
      cost: number;
      itemCostKnown: boolean;
      product?: typeof products.$inferSelect;
    }> = [];
    for (const item of input.items) {
      let product;
      if (item.fromInventory && !item.productId)
        throw new Error("Una venta desde inventario necesita un producto");
      if (item.fromInventory && item.productId) {
        const rows = await tx
          .select()
          .from(products)
          .where(eq(products.id, item.productId))
          .limit(1);
        product = rows[0];
        if (!product) throw new Error("Producto de inventario no encontrado");
        if (product.stock < item.quantity)
          throw new Error(`Stock insuficiente para ${product.name}`);
      }
      const itemCostKnown = item.fromInventory || item.unitCost !== undefined;
      const cost = itemCostKnown
        ? (item.unitCost ?? (product ? Number(product.cost) : 0))
        : 0;
      total += item.unitPrice * item.quantity;
      if (itemCostKnown) totalCost += cost * item.quantity;
      else costKnown = false;
      prepared.push({ item, cost, itemCostKnown, product });
    }
    const profit = costKnown ? total - totalCost : 0;
    const paidAmount =
      input.paymentStatus === "partial"
        ? Math.max(0, Math.min(total, Number(input.paidAmount ?? 0)))
        : total;
    const balance = Number((total - paidAmount).toFixed(2));
    if (balance > 0 && !input.customerName?.trim())
      throw new Error(
        "Para registrar un pago parcial necesitás indicar el cliente que queda como deudor"
      );
    let resolvedCustomerId = input.customerId;
    let resolvedCustomerName = input.customerName?.trim() || undefined;
    let resolvedCustomerPhone = input.customerPhone?.trim() || undefined;
    if (resolvedCustomerId || resolvedCustomerName || resolvedCustomerPhone) {
      const customerRows = await tx.select().from(customers);
      let customer = resolvedCustomerId
        ? customerRows.find((item: any) => item.id === resolvedCustomerId)
        : undefined;
      const phoneKey = normalizePhone(resolvedCustomerPhone);
      const nameKey = normalizeIdentity(resolvedCustomerName);
      customer ||= phoneKey
        ? customerRows.find(
            (item: any) => normalizePhone(item.phone) === phoneKey
          )
        : undefined;
      customer ||= nameKey
        ? customerRows.find(
            (item: any) => normalizeIdentity(item.name) === nameKey
          )
        : undefined;
      if (!customer && resolvedCustomerName) {
        const created = await tx.insert(customers).values({
          name: resolvedCustomerName,
          phone: resolvedCustomerPhone || null,
          purchases: 0,
          spent: "0.00",
          profit: "0.00",
          firstPurchase: null,
          lastPurchase: null,
          createdBy: input.userId,
          updatedBy: input.userId,
        });
        resolvedCustomerId = Number(created[0].insertId);
      } else if (customer) {
        resolvedCustomerId = customer.id;
        resolvedCustomerName ||= customer.name;
        resolvedCustomerPhone ||= customer.phone || undefined;
        if (
          (resolvedCustomerName && resolvedCustomerName !== customer.name) ||
          (resolvedCustomerPhone && resolvedCustomerPhone !== customer.phone)
        )
          await tx
            .update(customers)
            .set({
              name: resolvedCustomerName,
              phone: resolvedCustomerPhone || customer.phone || null,
              updatedBy: input.userId,
            })
            .where(eq(customers.id, customer.id));
      }
    }
    const inserted = await tx.insert(sales).values({
      saleDate: input.date,
      customerId: resolvedCustomerId,
      customerName: resolvedCustomerName,
      customerPhone: resolvedCustomerPhone,
      channel: input.channel || "WhatsApp",
      total: toMoney(total),
      totalCost: toMoney(totalCost),
      profit: toMoney(profit),
      margin: costKnown && total ? toMoney((profit / total) * 100) : "0.00",
      costKnown,
      notes:
        input.notes ||
        prepared
          .map(p => `${p.item.quantity || 1} ${p.item.description}`.trim())
          .filter(Boolean)
          .join(" · "),
      createdBy: input.userId,
      updatedBy: input.userId,
    });
    const saleId = Number(inserted[0].insertId);
    for (const p of prepared) {
      const { item, cost, itemCostKnown, product } = p;
      await tx.insert(saleItems).values({
        saleId,
        productId: product?.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: toMoney(item.unitPrice),
        unitCost: toMoney(cost),
        total: toMoney(item.unitPrice * item.quantity),
        costTotal: toMoney(cost * item.quantity),
        profit: itemCostKnown
          ? toMoney((item.unitPrice - cost) * item.quantity)
          : "0.00",
        costKnown: itemCostKnown,
        fromInventory: item.fromInventory,
        supplier: item.supplier,
        createdBy: input.userId,
        updatedBy: input.userId,
      });
      if (product && item.fromInventory) {
        await tx
          .update(products)
          .set({
            stock: product.stock - item.quantity,
            updatedBy: input.userId,
          })
          .where(eq(products.id, product.id));
        await tx.insert(stockMovements).values({
          productId: product.id,
          type: "sale",
          quantity: -item.quantity,
          unitCost: toMoney(cost),
          referenceId: saleId,
          createdBy: input.userId,
          updatedBy: input.userId,
        });
      }
    }
    if (resolvedCustomerId) await refreshCustomerStats(tx, resolvedCustomerId);
    let receivableId: number | undefined;
    if (balance > 0) {
      const receivable = await tx.insert(receivables).values({
        customerName: resolvedCustomerName!.trim(),
        phone: resolvedCustomerPhone,
        description: `Saldo pendiente de venta #${saleId}`,
        principal: toMoney(total),
        paid: toMoney(paidAmount),
        balance: toMoney(balance),
        dueDate: input.date,
        status: debtStatus(total, paidAmount, balance, input.date),
        notes: "Creado automáticamente al registrar una venta con pago parcial",
        createdBy: input.userId,
        updatedBy: input.userId,
      });
      receivableId = Number(receivable[0].insertId);
    }
    return {
      saleId,
      total,
      totalCost,
      profit,
      costKnown,
      paidAmount,
      balance,
      receivableId,
    };
  });
}

export async function createExpense(input: {
  date: string;
  category: string;
  description: string;
  amount: number;
  type?: string;
  platform?: string;
  campaign?: string;
  notes?: string;
  userId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const searchable = `${input.category} ${input.type || ""} ${input.description}`.toLocaleLowerCase("es-AR");
  const isAdvertising = !input.category.toLocaleLowerCase("es-AR").includes("publicista") && (searchable.includes("publicidad") || searchable.includes("meta ads") || searchable.includes("rdads"));
  const result = await db.insert(expenses).values({
    expenseDate: input.date,
    category: isAdvertising ? "Publicidad" : input.category,
    description: isAdvertising ? "Publicidad" : input.description,
    amount: toMoney(input.amount),
    type: isAdvertising ? "Publicitario" : input.type || "Operativo",
    platform: input.platform,
    campaign: input.campaign,
    notes: input.notes,
    createdBy: input.userId,
    updatedBy: input.userId,
  });
  return Number(result[0].insertId);
}

export async function createLoan(input: {
  kind: "loan" | "payable_merch" | "internal";
  counterparty: string;
  description?: string;
  currency?: string;
  interestRate?: number;
  interestUnit?: "percent" | "usd";
  interestPeriod?: "daily" | "monthly" | "weekly";
  principal: number;
  repaymentAmount?: number;
  installmentCount?: number;
  installmentAmount?: number;
  installmentPeriod?: "monthly" | "weekly";
  hasDueDate?: boolean;
  dueDate?: string;
  startDate?: string;
  notes?: string;
  userId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const repayment =
    input.kind === "payable_merch"
      ? input.principal
      : Number(input.repaymentAmount ?? input.principal);
  const hasDueDate = input.hasDueDate ?? true;
  const installments =
    input.installmentCount && input.installmentCount > 0
      ? input.installmentCount
      : null;
  const installmentAmount = installments
    ? Number(input.installmentAmount ?? repayment / installments)
    : null;
  const result = await db.insert(loans).values({
    kind: input.kind,
    counterparty: input.counterparty,
    description: input.description,
    currency: input.currency || "USD",
    interestRate: toMoney(input.interestRate ?? 0),
    interestUnit: input.interestUnit || "percent",
    interestPeriod: input.interestPeriod || "monthly",
    principal: toMoney(input.principal),
    repaymentAmount: toMoney(repayment),
    installmentCount: installments,
    installmentAmount:
      installmentAmount === null ? null : toMoney(installmentAmount),
    installmentPeriod: input.installmentPeriod || "weekly",
    hasDueDate,
    balance: toMoney(repayment),
    paid: "0.00",
    dueDate: hasDueDate ? input.dueDate : null,
    startDate: input.startDate,
    status: debtStatus(
      repayment,
      0,
      repayment,
      hasDueDate ? input.dueDate : undefined
    ),
    notes: input.notes,
    createdBy: input.userId,
    updatedBy: input.userId,
  });
  return Number(result[0].insertId);
}

async function recordLoanSettlementInterest(
  tx: any,
  row: any,
  totalDue: number,
  paid: number,
  userId?: number
) {
  if (paid <= 0 || totalDue <= 0 || paid < totalDue - 0.005) {
    return 0;
  }
  const existing = (
    await tx
      .select({ total: sql<number>`coalesce(sum(${expenses.amount}), 0)` })
      .from(expenses)
      .where(sql`(${expenses.notes} like ${`%compromiso #${row.id}%`} or ${expenses.notes} like ${`%deuda #${row.id}%`})`)
  )[0];
  const alreadyRecorded = Number(existing?.total ?? 0);
  const hasInterest =
    Number(row.interestRate ?? 0) > 0 || alreadyRecorded > 0;
  if (!hasInterest) return 0;
  const totalInterest = Math.max(
    0,
    Number((totalDue - Number(row.principal ?? 0)).toFixed(2))
  );
  const pendingInterest = Math.max(
    0,
    Number((totalInterest - alreadyRecorded).toFixed(2))
  );
  if (pendingInterest <= 0) return 0;
  await tx.insert(expenses).values({
    expenseDate: dateKeyInTimeZone(),
    category: "Intereses de deuda",
    description: `Interés de compromiso saldado · ${row.counterparty}`,
    amount: toMoney(pendingInterest),
    type: "Operativo",
    notes: `Interés reconocido al saldar compromiso #${row.id}`,
    createdBy: userId,
    updatedBy: userId,
  });
  return pendingInterest;
}

export async function payLoan(id: number, amount: number, userId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async tx => {
    const row = (
      await tx.select().from(loans).where(eq(loans.id, id)).limit(1)
    )[0];
    if (!row) throw new Error("Deuda no encontrada");
    const totalDue = effectiveLoanAmounts(row).totalDue;
    const paid = Math.min(totalDue, Number(row.paid) + amount);
    const balance = Math.max(0, totalDue - paid);
    await tx
      .update(loans)
      .set({
        paid: toMoney(paid),
        balance: toMoney(balance),
        status: debtStatus(totalDue, paid, balance, row.dueDate),
        updatedBy: userId,
      })
      .where(eq(loans.id, id));
    const interestExpense = await recordLoanSettlementInterest(
      tx,
      row,
      totalDue,
      paid,
      userId
    );
    return { balance, interestExpense };
  });
}

export async function applyLoanInterest(id: number, userId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async tx => {
    const row = (await tx.select().from(loans).where(eq(loans.id, id)).limit(1))[0];
    if (!row) throw new Error("Compromiso no encontrado");
    const balance = Number(row.balance || 0);
    const rate = Number(row.interestRate || 0);
    if (balance <= 0) throw new Error("El compromiso ya está saldado");
    if (rate <= 0) throw new Error("Este compromiso no tiene una tasa de interés configurada");
    const interest = row.interestUnit === "usd" ? rate : balance * rate / 100;
    const nextBalance = Number((balance + interest).toFixed(2));
    const nextRepayment = Number(row.repaymentAmount || row.principal || 0) + interest;
    await tx.update(loans).set({
      repaymentAmount: toMoney(nextRepayment),
      balance: toMoney(nextBalance),
      status: debtStatus(nextRepayment, Number(row.paid), nextBalance, row.dueDate),
      updatedBy: userId,
    }).where(eq(loans.id, id));
    await tx.insert(expenses).values({
      expenseDate: dateKeyInTimeZone(),
      category: "Intereses de deuda",
      description: `Interés de compromiso · ${row.counterparty}`,
      amount: toMoney(interest),
      type: "Operativo",
      notes: `Aplicado a la deuda #${id} (${row.interestUnit === "usd" ? "USD" : "%"} ${row.interestRate} ${row.interestPeriod})`,
      createdBy: userId,
      updatedBy: userId,
    });
    return { id, interest, balance: nextBalance };
  });
}

export async function createReceivable(input: {
  customerName: string;
  phone?: string;
  description?: string;
  principal: number;
  dueDate?: string;
  notes?: string;
  userId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(receivables).values({
    customerName: input.customerName,
    phone: input.phone,
    description: input.description,
    principal: toMoney(input.principal),
    balance: toMoney(input.principal),
    paid: "0.00",
    dueDate: input.dueDate,
    status: debtStatus(input.principal, 0, input.principal, input.dueDate),
    notes: input.notes,
    createdBy: input.userId,
    updatedBy: input.userId,
  });
  return Number(result[0].insertId);
}

export async function payReceivable(
  id: number,
  amount: number,
  userId?: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const row = (
    await db.select().from(receivables).where(eq(receivables.id, id)).limit(1)
  )[0];
  if (!row) throw new Error("Deudor no encontrado");
  const paid = Math.min(Number(row.principal), Number(row.paid) + amount);
  const balance = Math.max(0, Number(row.principal) - paid);
  await db
    .update(receivables)
    .set({
      paid: toMoney(paid),
      balance: toMoney(balance),
      status: debtStatus(row.principal, paid, balance, row.dueDate),
      updatedBy: userId,
    })
    .where(eq(receivables.id, id));
  return { balance };
}

export async function updateExpense(
  id: number,
  input: {
    date: string;
    category: string;
    description: string;
    amount: number;
    type?: string;
    notes?: string;
    userId?: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const searchable = `${input.category} ${input.type || ""} ${input.description}`.toLocaleLowerCase("es-AR");
  const isAdvertising = !input.category.toLocaleLowerCase("es-AR").includes("publicista") && (searchable.includes("publicidad") || searchable.includes("meta ads") || searchable.includes("rdads"));
  await db
    .update(expenses)
    .set({
      expenseDate: input.date,
      category: isAdvertising ? "Publicidad" : input.category,
      description: isAdvertising ? "Publicidad" : input.description,
      amount: toMoney(input.amount),
      type: isAdvertising ? "Publicitario" : input.type || "Operativo",
      notes: input.notes || null,
      updatedBy: input.userId,
    })
    .where(eq(expenses.id, id));
  return { id };
}

export async function deleteExpense(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(expenses).where(eq(expenses.id, id));
  return { id };
}

export async function updateLoan(
  id: number,
  input: {
    kind: "loan" | "payable_merch" | "internal";
    counterparty: string;
    description?: string;
    currency?: string;
    interestRate?: number;
    interestUnit?: "percent" | "usd";
    interestPeriod?: "daily" | "monthly" | "weekly";
    principal: number;
    repaymentAmount?: number;
    installmentCount?: number;
    installmentAmount?: number;
    installmentPeriod?: "monthly" | "weekly";
    hasDueDate?: boolean;
    paid: number;
    dueDate?: string;
    startDate?: string;
    notes?: string;
    userId?: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async tx => {
    const previous = (
      await tx.select().from(loans).where(eq(loans.id, id)).limit(1)
    )[0];
    if (!previous) throw new Error("Compromiso no encontrado");
    const repayment =
      input.kind === "payable_merch"
        ? input.principal
        : Number(input.repaymentAmount ?? input.principal);
    const hasDueDate = input.hasDueDate ?? true;
    const capitalized = effectiveLoanAmounts({
      kind: input.kind,
      hasDueDate,
      startDate: input.startDate,
      interestRate: input.interestRate ?? 0,
      interestUnit: input.interestUnit || "percent",
      interestPeriod: input.interestPeriod || "monthly",
      principal: input.principal,
      repaymentAmount: repayment,
      paid: input.paid,
    });
    const paid = Math.min(capitalized.totalDue, Math.max(0, input.paid));
    const balance = Math.max(0, capitalized.totalDue - paid);
    const installments =
      input.installmentCount && input.installmentCount > 0
        ? input.installmentCount
        : null;
    await tx
      .update(loans)
      .set({
        kind: input.kind,
        counterparty: input.counterparty,
        description: input.description || null,
        currency: input.currency || "USD",
        interestRate: toMoney(input.interestRate ?? 0),
        interestUnit: input.interestUnit || "percent",
        interestPeriod: input.interestPeriod || "monthly",
        principal: toMoney(input.principal),
        repaymentAmount: toMoney(repayment),
        installmentCount: installments,
        installmentAmount: installments
          ? toMoney(input.installmentAmount ?? repayment / installments)
          : null,
        installmentPeriod: input.installmentPeriod || "weekly",
        hasDueDate,
        paid: toMoney(paid),
        balance: toMoney(balance),
        startDate: input.startDate || null,
        dueDate: hasDueDate ? input.dueDate || null : null,
        status: debtStatus(
          capitalized.totalDue,
          paid,
          balance,
          hasDueDate ? input.dueDate : undefined
        ),
        notes: input.notes || null,
        updatedBy: input.userId,
      })
      .where(eq(loans.id, id));
    const interestExpense = await recordLoanSettlementInterest(
      tx,
      { ...previous, id, principal: input.principal, interestRate: input.interestRate ?? 0 },
      capitalized.totalDue,
      paid,
      input.userId
    );
    return { id, balance, interestExpense };
  });
}

export async function deleteLoan(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(loans).where(eq(loans.id, id));
  return { id };
}

export async function updateReceivable(
  id: number,
  input: {
    customerName: string;
    phone?: string;
    description?: string;
    principal: number;
    paid: number;
    dueDate?: string;
    notes?: string;
    userId?: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const paid = Math.min(input.principal, Math.max(0, input.paid));
  const balance = Math.max(0, input.principal - paid);
  await db
    .update(receivables)
    .set({
      customerName: input.customerName,
      phone: input.phone || null,
      description: input.description || null,
      principal: toMoney(input.principal),
      paid: toMoney(paid),
      balance: toMoney(balance),
      dueDate: input.dueDate || null,
      status: debtStatus(input.principal, paid, balance, input.dueDate),
      notes: input.notes || null,
      updatedBy: input.userId,
    })
    .where(eq(receivables.id, id));
  return { id, balance };
}

export async function deleteReceivable(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(receivables).where(eq(receivables.id, id));
  return { id };
}

export async function createAd(input: {
  date: string;
  platform: string;
  campaign: string;
  amount: number;
  conversations?: number;
  results?: number;
  notes?: string;
  userId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(adCampaigns).values({
    adDate: input.date,
    platform: input.platform,
    campaign: input.campaign,
    amount: toMoney(input.amount),
    conversations: input.conversations ?? 0,
    results: input.results ?? 0,
    notes: input.notes,
    createdBy: input.userId,
    updatedBy: input.userId,
  });
  return Number(result[0].insertId);
}

export async function updateAd(
  id: number,
  input: {
    date: string;
    platform: string;
    campaign: string;
    amount: number;
    conversations?: number;
    results?: number;
    notes?: string;
    userId?: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db
    .update(adCampaigns)
    .set({
      adDate: input.date,
      platform: input.platform,
      campaign: input.campaign,
      amount: toMoney(input.amount),
      conversations: input.conversations ?? 0,
      results: input.results ?? 0,
      notes: input.notes || null,
      updatedBy: input.userId,
    })
    .where(eq(adCampaigns.id, id));
  return { id };
}

export async function deleteAd(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(adCampaigns).where(eq(adCampaigns.id, id));
  return { id };
}

export async function updateObjective(
  id: number,
  input: {
    month: string;
    targetOrders: number;
    targetRevenue: number;
    targetProfit: number;
    targetNet: number;
    notes?: string;
    userId?: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db
    .update(objectives)
    .set({
      month: input.month,
      targetOrders: input.targetOrders,
      targetRevenue: toMoney(input.targetRevenue),
      targetProfit: toMoney(input.targetProfit),
      targetNet: toMoney(input.targetNet),
      notes: input.notes || null,
      updatedBy: input.userId,
    })
    .where(eq(objectives.id, id));
  return { id };
}

export async function deleteObjective(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(objectives).where(eq(objectives.id, id));
  return { id };
}

export async function getProjections(growthPercent = 15) {
  const db = await getDb();
  if (!db) return null;
  await ensureSeeded();
  const todayKey = dateKeyInTimeZone();
  const from = shiftDateKey(todayKey, -30);
  const to = shiftDateKey(todayKey, 1);
  const paidWhere = and(
    gte(sales.saleDate, from),
    lt(sales.saleDate, to),
    sql`${sales.status} <> 'cancelled'`
  );
  const [summary, units, daysWithSales, expenseRows, adRows] =
    await Promise.all([
      db
        .select({
          revenue: sql<number>`coalesce(sum(${sales.total}),0)`,
          profit: sql<number>`coalesce(sum(case when ${sales.costKnown} = true then ${sales.profit} else 0 end),0)`,
          orders: sql<number>`count(*)`,
          incomplete: sql<number>`coalesce(sum(case when ${sales.costKnown} = false then 1 else 0 end),0)`,
        })
        .from(sales)
        .where(paidWhere),
      db
        .select({ units: sql<number>`coalesce(sum(${saleItems.quantity}),0)` })
        .from(saleItems)
        .innerJoin(sales, eq(saleItems.saleId, sales.id))
        .where(paidWhere),
      db
        .select({ days: sql<number>`count(distinct ${sales.saleDate})` })
        .from(sales)
        .where(paidWhere),
      db
        .select({ total: sql<number>`coalesce(sum(${expenses.amount}),0)` })
        .from(expenses)
        .where(
          and(gte(expenses.expenseDate, from), lt(expenses.expenseDate, to))
        ),
      db
        .select({ total: sql<number>`coalesce(sum(${adCampaigns.amount}),0)` })
        .from(adCampaigns)
        .where(and(gte(adCampaigns.adDate, from), lt(adCampaigns.adDate, to))),
    ]);
  const revenue = Number(summary[0]?.revenue ?? 0);
  const profit = Number(summary[0]?.profit ?? 0);
  const orders = Number(summary[0]?.orders ?? 0);
  const unitsSold = Number(units[0]?.units ?? 0);
  const expenseTotal = Number(expenseRows[0]?.total ?? 0);
  const adSpend = Number(adRows[0]?.total ?? 0);
  const activeDays = Math.max(1, Number(daysWithSales[0]?.days ?? 0));
  const growth = Math.max(-50, Math.min(200, Number(growthPercent) || 0)) / 100;
  const currentDate = new Date(`${todayKey}T12:00:00Z`);
  const nextMonthStart = new Date(
    Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() + 1, 1)
  );
  const nextMonthDays = new Date(
    Date.UTC(currentDate.getUTCFullYear(),
    currentDate.getUTCMonth() + 2,
    0
  )).getDate();
  const daily = {
    revenue: revenue / activeDays,
    profit: profit / activeDays,
    orders: orders / activeDays,
    units: unitsSold / activeDays,
    net: (profit - expenseTotal - adSpend) / activeDays,
  };
  const factor = 1 + growth;
  return {
    period: {
      from,
      to: todayKey,
      activeDays,
    },
    targetMonth: nextMonthStart.toLocaleDateString("es-AR", {
      month: "long",
      year: "numeric",
    }),
    targetMonthDays: nextMonthDays,
    growthPercent: growth * 100,
    current: {
      revenue,
      profit,
      orders,
      units: unitsSold,
      expenses: expenseTotal,
      adSpend,
      net: profit - expenseTotal - adSpend,
      incompleteCosts: Number(summary[0]?.incomplete ?? 0),
    },
    projected: {
      revenue: daily.revenue * nextMonthDays * factor,
      profit: daily.profit * nextMonthDays * factor,
      orders: daily.orders * nextMonthDays * factor,
      units: daily.units * nextMonthDays * factor,
      net: daily.net * nextMonthDays * factor,
    },
    daily,
  };
}

export async function getDollarRates() {
  const url = "https://dolarhoy.com/";
  const parseAmount = (raw: string) =>
    Number(
      raw
        .replace(/\./g, "")
        .replace(",", ".")
        .replace(/[^0-9.-]/g, "")
    );
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: { Accept: "text/html" },
    });
    if (!response.ok) throw new Error(`DolarHoy respondió ${response.status}`);
    const html = await response.text();
    const rates: Array<{
      moneda: string;
      casa: string;
      nombre: string;
      compra: number;
      venta: number;
      fechaActualizacion: string;
    }> = [];
    const add = (
      casa: string,
      nombre: string,
      compra: string,
      venta: string
    ) => {
      if (
        Number.isFinite(parseAmount(compra)) &&
        Number.isFinite(parseAmount(venta))
      )
        rates.push({
          moneda: "USD",
          casa,
          nombre,
          compra: parseAmount(compra),
          venta: parseAmount(venta),
          fechaActualizacion: new Date().toISOString(),
        });
    };
    const main =
      /<div class="title"><a class="titleText" href="\/cotizaciondolar(blue|oficial)"[^>]*>([^<]+)<\/a><\/div><div class="values">.*?<div class="compra">.*?<div class="val">\$([^<]+)<\/div>.*?<div class="venta">.*?<div class="val">\$([^<]+)<\/div>/gs;
    for (const match of html.matchAll(main))
      add(
        match[1] === "oficial" ? "oficial" : "blue",
        match[2].trim(),
        match[3].trim(),
        match[4].trim()
      );
    const table =
      /<a href="\/(cotizaciondolarbolsa|cotizaciondolarcontadoconliqui)"><div class="title">([^<]+)<\/div><div class="compra">([^<]+)<\/div><div class="venta">([^<]+)<\/div><\/a>/g;
    for (const match of html.matchAll(table))
      add(
        match[1] === "cotizaciondolarbolsa" ? "bolsa" : "contadoconliqui",
        match[2].trim(),
        match[3].trim(),
        match[4].trim()
      );
    if (rates.length < 4)
      throw new Error("DolarHoy no devolvió las cuatro cotizaciones esperadas");
    lastDollarRates = rates;
    try {
      const usdtResponse = await fetch(
        "https://api.binance.com/api/v3/ticker/price?symbol=USDTARS",
        {
          signal: AbortSignal.timeout(5000),
          headers: { Accept: "application/json" },
        }
      );
      if (usdtResponse.ok) {
        const payload = (await usdtResponse.json()) as {
          symbol?: string;
          price?: string;
        };
        const price = Number(payload.price);
        if (Number.isFinite(price) && price > 0)
          lastUsdtRate = {
            symbol: payload.symbol || "USDTARS",
            price,
            source: "Binance",
            fetchedAt: new Date().toISOString(),
          };
      }
    } catch {
      /* la referencia USDT es opcional; se conserva el último valor */
    }
    const updatedLabel =
      html.match(/Actualizado por última vez:\s*([^<]+)/i)?.[1]?.trim() ||
      "hora no informada";
    return {
      source: "DolarHoy",
      sourceUrl: url,
      fetchedAt: new Date().toISOString(),
      updatedLabel,
      rates,
      usdt: lastUsdtRate,
    };
  } catch (error) {
    console.warn("[Dólar] No se pudo actualizar la cotización:", error);
    return {
      source: "DolarHoy",
      sourceUrl: url,
      fetchedAt: new Date().toISOString(),
      updatedLabel: "último valor disponible",
      rates: lastDollarRates,
      usdt: lastUsdtRate,
      stale: true,
      error: "No se pudo actualizar; se muestra el último valor válido",
    };
  }
}
