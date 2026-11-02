import { boolean, date, decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

const audit = {
  createdBy: int("createdBy"),
  updatedBy: int("updatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
};

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  legacyId: int("legacyId"),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 120 }).notNull().default("Sin categoría"),
  supplier: varchar("supplier", { length: 160 }).default("Propio"),
  stock: int("stock").notNull().default(0),
  cost: decimal("cost", { precision: 12, scale: 2 }).notNull().default("0"),
  minStock: int("minStock").notNull().default(3),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  ...audit,
}, table => ({ nameIdx: index("products_name_idx").on(table.name), categoryIdx: index("products_category_idx").on(table.category) }));

export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  phone: varchar("phone", { length: 80 }),
  locality: varchar("locality", { length: 140 }),
  notes: text("notes"),
  purchases: int("purchases").notNull().default(0),
  spent: decimal("spent", { precision: 12, scale: 2 }).notNull().default("0"),
  profit: decimal("profit", { precision: 12, scale: 2 }).notNull().default("0"),
  firstPurchase: date("firstPurchase", { mode: "string" }),
  lastPurchase: date("lastPurchase", { mode: "string" }),
  ...audit,
}, table => ({ phoneIdx: index("customers_phone_idx").on(table.phone), lastPurchaseIdx: index("customers_last_purchase_idx").on(table.lastPurchase) }));

export const sales = mysqlTable("sales", {
  id: int("id").autoincrement().primaryKey(),
  legacyId: int("legacyId"),
  saleDate: date("saleDate", { mode: "string" }).notNull(),
  customerId: int("customerId"),
  customerName: varchar("customerName", { length: 180 }),
  customerPhone: varchar("customerPhone", { length: 80 }),
  channel: varchar("channel", { length: 80 }).default("WhatsApp"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull().default("0"),
  totalCost: decimal("totalCost", { precision: 12, scale: 2 }).notNull().default("0"),
  profit: decimal("profit", { precision: 12, scale: 2 }).notNull().default("0"),
  margin: decimal("margin", { precision: 8, scale: 2 }).notNull().default("0"),
  costKnown: boolean("costKnown").notNull().default(true),
  status: mysqlEnum("status", ["paid", "pending", "cancelled"]).notNull().default("paid"),
  notes: text("notes"),
  ...audit,
}, table => ({ dateIdx: index("sales_date_idx").on(table.saleDate), customerIdx: index("sales_customer_idx").on(table.customerId) }));

export const saleItems = mysqlTable("sale_items", {
  id: int("id").autoincrement().primaryKey(),
  saleId: int("saleId").notNull(),
  productId: int("productId"),
  description: text("description").notNull(),
  quantity: int("quantity").notNull().default(1),
  unitPrice: decimal("unitPrice", { precision: 12, scale: 2 }).notNull().default("0"),
  unitCost: decimal("unitCost", { precision: 12, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull().default("0"),
  costTotal: decimal("costTotal", { precision: 12, scale: 2 }).notNull().default("0"),
  profit: decimal("profit", { precision: 12, scale: 2 }).notNull().default("0"),
  costKnown: boolean("costKnown").notNull().default(true),
  fromInventory: boolean("fromInventory").notNull().default(false),
  supplier: varchar("supplier", { length: 160 }),
  ...audit,
}, table => ({ saleIdx: index("sale_items_sale_idx").on(table.saleId), productIdx: index("sale_items_product_idx").on(table.productId) }));

export const stockMovements = mysqlTable("stock_movements", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  type: mysqlEnum("type", ["purchase", "sale", "adjustment", "return"]).notNull(),
  quantity: int("quantity").notNull(),
  unitCost: decimal("unitCost", { precision: 12, scale: 2 }).notNull().default("0"),
  referenceId: int("referenceId"),
  notes: text("notes"),
  ...audit,
}, table => ({ productIdx: index("stock_movements_product_idx").on(table.productId) }));

export const expenses = mysqlTable("expenses", {
  id: int("id").autoincrement().primaryKey(),
  expenseDate: date("expenseDate", { mode: "string" }).notNull(),
  category: varchar("category", { length: 120 }).notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  type: varchar("type", { length: 80 }).default("Operativo"),
  platform: varchar("platform", { length: 80 }),
  campaign: varchar("campaign", { length: 180 }),
  notes: text("notes"),
  ...audit,
}, table => ({ dateIdx: index("expenses_date_idx").on(table.expenseDate) }));

export const loans = mysqlTable("loans", {
  id: int("id").autoincrement().primaryKey(),
  kind: mysqlEnum("kind", ["loan", "payable_merch", "internal"]).notNull().default("loan"),
  counterparty: varchar("counterparty", { length: 180 }).notNull(),
  description: varchar("description", { length: 255 }),
  currency: varchar("currency", { length: 12 }).notNull().default("USD"),
  interestRate: decimal("interestRate", { precision: 8, scale: 2 }).notNull().default("0"),
  interestUnit: varchar("interestUnit", { length: 16 }).notNull().default("percent"),
  interestPeriod: mysqlEnum("interestPeriod", ["daily", "monthly", "weekly"]).notNull().default("monthly"),
  interestStartDate: date("interestStartDate", { mode: "string" }),
  principal: decimal("principal", { precision: 12, scale: 2 }).notNull().default("0"),
  repaymentAmount: decimal("repaymentAmount", { precision: 12, scale: 2 }),
  installmentCount: int("installmentCount"),
  installmentAmount: decimal("installmentAmount", { precision: 12, scale: 2 }),
  installmentPeriod: mysqlEnum("installmentPeriod", ["weekly", "monthly"]).default("weekly"),
  hasDueDate: boolean("hasDueDate").notNull().default(true),
  paid: decimal("paid", { precision: 12, scale: 2 }).notNull().default("0"),
  balance: decimal("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  startDate: date("startDate", { mode: "string" }),
  dueDate: date("dueDate", { mode: "string" }),
  status: mysqlEnum("status", ["open", "partial", "paid", "overdue"]).notNull().default("open"),
  notes: text("notes"),
  ...audit,
}, table => ({ dueIdx: index("loans_due_idx").on(table.dueDate), statusIdx: index("loans_status_idx").on(table.status) }));

export const receivables = mysqlTable("receivables", {
  id: int("id").autoincrement().primaryKey(),
  customerName: varchar("customerName", { length: 180 }).notNull(),
  phone: varchar("phone", { length: 80 }),
  description: varchar("description", { length: 255 }),
  principal: decimal("principal", { precision: 12, scale: 2 }).notNull().default("0"),
  paid: decimal("paid", { precision: 12, scale: 2 }).notNull().default("0"),
  balance: decimal("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  dueDate: date("dueDate", { mode: "string" }),
  status: mysqlEnum("status", ["open", "partial", "paid", "overdue"]).notNull().default("open"),
  notes: text("notes"),
  ...audit,
}, table => ({ dueIdx: index("receivables_due_idx").on(table.dueDate), statusIdx: index("receivables_status_idx").on(table.status) }));

export const adCampaigns = mysqlTable("ad_campaigns", {
  id: int("id").autoincrement().primaryKey(),
  adDate: date("adDate", { mode: "string" }).notNull(),
  platform: varchar("platform", { length: 80 }).notNull().default("Meta Ads"),
  campaign: varchar("campaign", { length: 180 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  conversations: int("conversations").default(0),
  results: int("results").default(0),
  notes: text("notes"),
  ...audit,
}, table => ({ dateIdx: index("ad_campaigns_date_idx").on(table.adDate) }));

export const metaAdInsights = mysqlTable("meta_ad_insights", {
  id: int("id").autoincrement().primaryKey(),
  accountId: varchar("accountId", { length: 64 }).notNull(),
  currency: varchar("currency", { length: 12 }).notNull().default("USD"),
  dateStart: date("dateStart", { mode: "string" }).notNull(),
  dateStop: date("dateStop", { mode: "string" }).notNull(),
  level: varchar("level", { length: 16 }).notNull().default("ad"),
  campaignId: varchar("campaignId", { length: 80 }).notNull(),
  campaignName: varchar("campaignName", { length: 180 }).notNull(),
  adsetId: varchar("adsetId", { length: 80 }),
  adsetName: varchar("adsetName", { length: 180 }),
  adId: varchar("adId", { length: 80 }).notNull(),
  adName: varchar("adName", { length: 180 }).notNull(),
  impressions: int("impressions").notNull().default(0),
  reach: int("reach").notNull().default(0),
  frequency: decimal("frequency", { precision: 10, scale: 4 }).notNull().default("0"),
  clicksAll: int("clicksAll").notNull().default(0),
  linkClicks: int("linkClicks").notNull().default(0),
  spend: decimal("spend", { precision: 12, scale: 2 }).notNull().default("0"),
  ctr: decimal("ctr", { precision: 10, scale: 4 }).notNull().default("0"),
  inlineLinkClickCtr: decimal("inlineLinkClickCtr", { precision: 10, scale: 4 }).notNull().default("0"),
  cpc: decimal("cpc", { precision: 12, scale: 4 }).notNull().default("0"),
  costPerLinkClick: decimal("costPerLinkClick", { precision: 12, scale: 4 }).notNull().default("0"),
  cpm: decimal("cpm", { precision: 12, scale: 4 }).notNull().default("0"),
  messagingConversations: int("messagingConversations").notNull().default(0),
  messagingReplies: int("messagingReplies").notNull().default(0),
  messagingConnections: int("messagingConnections").notNull().default(0),
  messagingFirstReplies: int("messagingFirstReplies").notNull().default(0),
  messagingDepth2: int("messagingDepth2").notNull().default(0),
  messagingDepth3: int("messagingDepth3").notNull().default(0),
  videoViews: int("videoViews").notNull().default(0),
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
}, table => ({
  uniqueInsight: uniqueIndex("meta_ad_insights_unique_idx").on(
    table.accountId,
    table.level,
    table.adId,
    table.dateStart,
    table.dateStop
  ),
  dateIdx: index("meta_ad_insights_date_idx").on(table.dateStart, table.dateStop),
  adIdx: index("meta_ad_insights_ad_idx").on(table.adId),
}));

export const backupSchedules = mysqlTable("backup_schedules", {
  id: int("id").primaryKey(),
  taskUid: varchar("taskUid", { length: 160 }).notNull().unique(),
  name: varchar("name", { length: 180 }).notNull(),
  cronExpression: varchar("cronExpression", { length: 80 }).notNull(),
  timezone: varchar("timezone", { length: 80 }).notNull().default("America/Argentina/Buenos_Aires"),
  enabled: boolean("enabled").notNull().default(true),
  lastRunAt: timestamp("lastRunAt"),
  ...audit,
});

export const backupSnapshots = mysqlTable("backup_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  backupDate: date("backupDate", { mode: "string" }).notNull().unique(),
  storageKey: varchar("storageKey", { length: 255 }).notNull(),
  storageUrl: varchar("storageUrl", { length: 255 }).notNull(),
  checksum: varchar("checksum", { length: 128 }).notNull(),
  rowCount: int("rowCount").notNull().default(0),
  status: mysqlEnum("status", ["completed", "failed"]).notNull().default("completed"),
  error: text("error"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const editorProposals = mysqlTable("editor_proposals", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 180 }).notNull(),
  filePath: varchar("filePath", { length: 255 }).notNull(),
  patch: text("patch").notNull(),
  status: mysqlEnum("status", ["proposed", "approved", "rejected", "applied"]).notNull().default("proposed"),
  submittedBy: varchar("submittedBy", { length: 180 }).notNull().default("Editor restringido"),
  reviewNote: text("reviewNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const objectives = mysqlTable("objectives", {
  id: int("id").autoincrement().primaryKey(),
  month: varchar("month", { length: 40 }).notNull(),
  targetOrders: int("targetOrders").notNull().default(0),
  targetRevenue: decimal("targetRevenue", { precision: 12, scale: 2 }).notNull().default("0"),
  targetProfit: decimal("targetProfit", { precision: 12, scale: 2 }).notNull().default("0"),
  targetNet: decimal("targetNet", { precision: 12, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  ...audit,
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Product = typeof products.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type Loan = typeof loans.$inferSelect;
