import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import {
  adCampaigns,
  backupSchedules,
  backupSnapshots,
  customers,
  expenses,
  editorProposals,
  loans,
  metaAdInsights,
  objectives,
  products,
  productFlavors,
  receivables,
  saleItems,
  sales,
  stockMovements,
} from "../drizzle/schema";
import { getDb } from "./db";
import { storagePut } from "./storage";

const BACKUP_SCHEDULE_ID = 1;
const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires";

function dateKeyInArgentina(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ARGENTINA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function tableRows(db: Awaited<ReturnType<typeof getDb>>, table: any) {
  if (!db) return [];
  return db.select().from(table);
}

export async function isAuthorizedBackupTask(taskUid: string | undefined) {
  if (!taskUid) return false;
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select({ taskUid: backupSchedules.taskUid })
    .from(backupSchedules)
    .where(and(
      eq(backupSchedules.id, BACKUP_SCHEDULE_ID),
      eq(backupSchedules.taskUid, taskUid),
      eq(backupSchedules.enabled, true),
    ))
    .limit(1);
  return rows.length > 0;
}

export async function saveBackupSchedule(taskUid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(backupSchedules).values({
    id: BACKUP_SCHEDULE_ID,
    taskUid,
    name: "Backup diario The Point Company",
    cronExpression: "0 59 23 * * *",
    timezone: ARGENTINA_TIME_ZONE,
    enabled: true,
  }).onDuplicateKeyUpdate({
    set: {
      taskUid,
      enabled: true,
      updatedAt: new Date(),
    },
  });
}

export async function createDailyBackup(taskUid?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const backupDate = dateKeyInArgentina();
  const [
    productRows,
    flavorRows,
    saleRows,
    saleItemRows,
    customerRows,
    expenseRows,
    loanRows,
    receivableRows,
    adRows,
    metaRows,
    objectiveRows,
    stockMovementRows,
    proposalRows,
  ] = await Promise.all([
    tableRows(db, products),
    tableRows(db, productFlavors),
    tableRows(db, sales),
    tableRows(db, saleItems),
    tableRows(db, customers),
    tableRows(db, expenses),
    tableRows(db, loans),
    tableRows(db, receivables),
    tableRows(db, adCampaigns),
    tableRows(db, metaAdInsights),
    tableRows(db, objectives),
    tableRows(db, stockMovements),
    tableRows(db, editorProposals),
  ]);
  const snapshot = {
    schemaVersion: 1,
    backupDate,
    generatedAt: new Date().toISOString(),
    tables: {
      products: productRows,
      productFlavors: flavorRows,
      sales: saleRows,
      saleItems: saleItemRows,
      customers: customerRows,
      expenses: expenseRows,
      loans: loanRows,
      receivables: receivableRows,
      adCampaigns: adRows,
      metaAdInsights: metaRows,
      objectives: objectiveRows,
      stockMovements: stockMovementRows,
      editorProposals: proposalRows,
    },
  };
  const body = JSON.stringify(snapshot);
  const checksum = createHash("sha256").update(body).digest("hex");
  const rowCount = Object.values(snapshot.tables).reduce((total, rows) => total + rows.length, 0);
  const stored = await storagePut(
    `backups/the-point-company-${backupDate}.json`,
    body,
    "application/json",
  );
  await db.insert(backupSnapshots).values({
    backupDate,
    storageKey: stored.key,
    storageUrl: stored.url,
    checksum,
    rowCount,
    status: "completed",
    error: null,
  }).onDuplicateKeyUpdate({
    set: {
      storageKey: stored.key,
      storageUrl: stored.url,
      checksum,
      rowCount,
      status: "completed",
      error: null,
      createdAt: new Date(),
    },
  });
  if (taskUid) {
    await db.update(backupSchedules).set({ lastRunAt: new Date() }).where(eq(backupSchedules.taskUid, taskUid));
  }
  return { backupDate, storageUrl: stored.url, checksum, rowCount };
}

export async function listBackups() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(backupSnapshots).orderBy(sql`${backupSnapshots.createdAt} desc`).limit(30);
}
