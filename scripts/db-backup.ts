import "dotenv/config";
import mysql from "mysql2/promise";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const out = process.argv[2] || `./backups/pointdesk-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
const tables = ["users", "products", "product_flavors", "customers", "sales", "sale_items", "stock_movements", "expenses", "loans", "receivables", "ad_campaigns", "meta_ad_insights", "objectives", "backup_snapshots", "backup_schedules", "editor_proposals"];
const pool = mysql.createPool(process.env.DATABASE_URL!);
try {
  const data: Record<string, unknown[]> = {};
  for (const table of tables) {
    const [rows] = await pool.query(`SELECT * FROM \`${table}\``);
    data[table] = rows as unknown[];
  }
  const payload = { exportedAt: new Date().toISOString(), tables: data };
  await mkdir(out.substring(0, out.lastIndexOf("/")) || ".", { recursive: true });
  const text = JSON.stringify(payload, null, 2) + "\n";
  await writeFile(out, text, { mode: 0o600 });
  await writeFile(`${out}.sha256`, `${createHash("sha256").update(text).digest("hex")}  ${out}\n`, { mode: 0o600 });
  console.log(`Backup escrito en ${out}`);
} finally { await pool.end(); }
