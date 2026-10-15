import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  adCampaigns,
  customers,
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
  if (due && due < new Date().toISOString().slice(0, 10)) return "overdue";
  return settled > 0 ? "partial" : "open";
}

function completedInterestPeriods(startDate: unknown, interestPeriod: unknown) {
  const start = String(startDate ?? "").slice(0, 10);
  if (!start) return 0;
  const startAt = new Date(`${start}T00:00:00Z`);
  if (Number.isNaN(startAt.getTime())) return 0;
  const now = new Date();
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
  interestPeriod?: unknown;
  principal: unknown;
  repaymentAmount?: unknown;
  paid: unknown;
}) {
  const base = Number(row.repaymentAmount ?? row.principal);
  const capitalizes =
    row.kind === "loan" &&
    row.hasDueDate === false &&
    Number(row.interestRate ?? 0) > 0;
  const periods = capitalizes
    ? completedInterestPeriods(row.startDate, row.interestPeriod)
    : 0;
  const totalDue = capitalizes
    ? base * Math.pow(1 + Number(row.interestRate) / 100, periods)
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
    if ((await count(adCampaigns)) === 0 && raw.ads.length)
      await db.insert(adCampaigns).values(
        raw.ads.map(a => ({
          adDate: parseSeedDate(a.date as string) || "2026-01-01",
          platform: String(a.platform || "Meta Ads"),
          campaign: "Campaña inicial propia de ventas - Multiples estilos",
          amount: toMoney(a.amount),
          notes: a.notes ? String(a.notes) : null,
          createdAt: now,
          updatedAt: now,
        }))
      );
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
  const expenseWhere =
    from && to
      ? and(gte(expenses.expenseDate, from), lt(expenses.expenseDate, to))
      : undefined;
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
  const adSpend = Number(adTotal[0]?.total ?? 0);
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
  const cashCollected = Math.max(
    0,
    revenue - Number(receivableBalance[0]?.balance ?? 0)
  );
  const cashOut = expenseTotal + adSpend;
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
    cashFlow: {
      collected: cashCollected,
      outflow: cashOut,
      net: cashCollected - cashOut,
      receivables: Number(receivableBalance[0]?.balance ?? 0),
      note: "Cobrado estimado: facturación menos saldos abiertos de clientes.",
    },
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
    .select({ saleId: saleItems.saleId, description: saleItems.description })
    .from(saleItems)
    .where(
      inArray(
        saleItems.saleId,
        rows.map(row => row.id)
      )
    )
    .orderBy(asc(saleItems.id));
  const descriptions = new Map<number, string[]>();
  for (const item of itemRows) {
    const values = descriptions.get(item.saleId) ?? [];
    if (item.description && !values.includes(item.description))
      values.push(item.description);
    descriptions.set(item.saleId, values);
  }
  return rows.map(row => ({
    ...row,
    notes: row.notes || descriptions.get(row.id)?.join(" · ") || null,
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
  return db
    .select()
    .from(expenses)
    .orderBy(desc(expenses.expenseDate), desc(expenses.id))
    .limit(100);
}
export async function listLoans() {
  const db = await getDb();
  if (!db) return [];
  await ensureSeeded();
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
    userId?: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async tx => {
    const current = (
      await tx.select().from(sales).where(eq(sales.id, id)).limit(1)
    )[0];
    if (!current) throw new Error("Venta no encontrada");
    const oldCustomerId = current.customerId;
    const costKnown = input.costKnown !== false;
    const profit = costKnown ? input.total - input.totalCost : 0;
    const storedCost = costKnown ? input.totalCost : 0;
    await tx
      .update(sales)
      .set({
        saleDate: input.date,
        customerId: input.customerId ?? null,
        customerName: input.customerName || null,
        customerPhone: input.customerPhone || null,
        channel: input.channel || "WhatsApp",
        total: toMoney(input.total),
        totalCost: toMoney(storedCost),
        profit: toMoney(profit),
        margin:
          costKnown && input.total
            ? toMoney((profit / input.total) * 100)
            : "0.00",
        costKnown,
        notes: input.notes,
        updatedBy: input.userId,
      })
      .where(eq(sales.id, id));
    const item = (
      await tx
        .select()
        .from(saleItems)
        .where(eq(saleItems.saleId, id))
        .orderBy(asc(saleItems.id))
        .limit(1)
    )[0];
    if (item) {
      const quantity = Math.max(1, item.quantity);
      await tx
        .update(saleItems)
        .set({
          description: input.description || item.description,
          unitPrice: toMoney(input.total / quantity),
          unitCost: toMoney(costKnown ? storedCost / quantity : 0),
          total: toMoney(input.total),
          costTotal: toMoney(storedCost),
          profit: toMoney(profit),
          costKnown,
          updatedBy: input.userId,
        })
        .where(eq(saleItems.id, item.id));
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
          .map(p => p.item.description)
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
  const result = await db.insert(expenses).values({
    expenseDate: input.date,
    category: input.category,
    description: input.description,
    amount: toMoney(input.amount),
    type: input.type || "Operativo",
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
  interestPeriod?: "monthly" | "weekly";
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

export async function payLoan(id: number, amount: number, userId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const row = (
    await db.select().from(loans).where(eq(loans.id, id)).limit(1)
  )[0];
  if (!row) throw new Error("Deuda no encontrada");
  const totalDue = effectiveLoanAmounts(row).totalDue;
  const paid = Math.min(totalDue, Number(row.paid) + amount);
  const balance = Math.max(0, totalDue - paid);
  await db
    .update(loans)
    .set({
      paid: toMoney(paid),
      balance: toMoney(balance),
      status: debtStatus(totalDue, paid, balance, row.dueDate),
      updatedBy: userId,
    })
    .where(eq(loans.id, id));
  return { balance };
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
  await db
    .update(expenses)
    .set({
      expenseDate: input.date,
      category: input.category,
      description: input.description,
      amount: toMoney(input.amount),
      type: input.type || "Operativo",
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
    interestPeriod?: "monthly" | "weekly";
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
  await db
    .update(loans)
    .set({
      kind: input.kind,
      counterparty: input.counterparty,
      description: input.description || null,
      currency: input.currency || "USD",
      interestRate: toMoney(input.interestRate ?? 0),
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
  return { id, balance };
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
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + 1);
  const start = new Date(now);
  start.setDate(start.getDate() - 30);
  const from = start.toISOString().slice(0, 10);
  const to = end.toISOString().slice(0, 10);
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
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthDays = new Date(
    now.getFullYear(),
    now.getMonth() + 2,
    0
  ).getDate();
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
      to:
        from === to
          ? to
          : new Date(now.getTime() - 86400000).toISOString().slice(0, 10),
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
