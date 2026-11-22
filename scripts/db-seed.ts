import "dotenv/config";
import { ensureSeeded } from "../server/db";
await ensureSeeded();
console.log("Seed/reconciliación completado de forma idempotente.");
