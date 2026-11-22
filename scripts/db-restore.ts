import "dotenv/config";
import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";

const file = process.argv[2];
const confirm = process.argv.includes("--confirm");
if (!file || !confirm) throw new Error("Uso: pnpm db:restore <archivo.json> --confirm");
const payload = JSON.parse(await readFile(file, "utf8"));
const pool = mysql.createPool(process.env.DATABASE_URL!);
const order = ["users", "products", "product_flavors", "customers", "sales", "sale_items", "stock_movements", "expenses", "loans", "receivables", "ad_campaigns", "meta_ad_insights", "objectives", "backup_snapshots", "backup_schedules", "editor_proposals"];
try {
  await pool.query("START TRANSACTION");
  for (const table of [...order].reverse()) await pool.query(`DELETE FROM \`${table}\``);
  for (const table of order) {
    const rows = payload.tables?.[table] || [];
    for (const row of rows) {
      const keys = Object.keys(row);
      if (!keys.length) continue;
      const columns = keys.map(key => `\`${key}\``).join(",");
      const placeholders = keys.map(() => "?").join(",");
      await pool.query(`INSERT INTO \`${table}\` (${columns}) VALUES (${placeholders})`, keys.map(key => row[key]));
    }
  }
  await pool.query("COMMIT");
  console.log(`Restauración completada desde ${file}`);
} catch (error) { await pool.query("ROLLBACK"); throw error; } finally { await pool.end(); }
