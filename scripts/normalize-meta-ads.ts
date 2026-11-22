import "dotenv/config";
import mysql from "mysql2/promise";

const ids = [600001, 600002, 600003, 630001, 630002];
const dryRun = process.argv.includes("--dry-run");

const pool = mysql.createPool(process.env.DATABASE_URL!);
try {
  const [rows] = await pool.query<any[]>(
    `SELECT id, expenseDate, amount, category, type, description FROM expenses WHERE id IN (${ids.map(() => "?").join(",")}) ORDER BY id`,
    ids,
  );
  console.table(rows);
  if (rows.length !== ids.length) throw new Error(`Se esperaban ${ids.length} registros y se encontraron ${rows.length}`);
  if (!dryRun) {
    await pool.query(
      `UPDATE expenses SET category='Publicidad', type='Meta Ads', description='Publicidad' WHERE id IN (${ids.map(() => "?").join(",")})`,
      ids,
    );
    const [verified] = await pool.query<any[]>(
      `SELECT id, category, type, description FROM expenses WHERE id IN (${ids.map(() => "?").join(",")}) ORDER BY id`,
      ids,
    );
    console.table(verified);
    if (verified.some(row => row.category !== "Publicidad" || row.type !== "Meta Ads" || row.description !== "Publicidad")) {
      throw new Error("La verificación de normalización falló");
    }
    console.log("Normalización aplicada de forma idempotente; no se duplicaron ni eliminaron registros.");
  } else {
    console.log("DRY RUN: no se modificó la base de datos.");
  }
} finally {
  await pool.end();
}
