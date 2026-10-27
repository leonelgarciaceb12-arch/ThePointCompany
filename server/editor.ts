import type { Express, Request, Response } from "express";
import { createEditorProposal, listEditorProposals } from "./db";
import {
  clearEditorSession,
  createEditorSession,
  editorPasswordMatches,
  getEditorSessionToken,
  isEditorSession,
  setEditorSession,
} from "./_core/editorAuth";

export const EDITOR_ALLOWED_PATHS = [
  "client/src/pages/Home.tsx",
  "client/src/App.tsx",
  "client/src/index.css",
  "server/db.ts",
  "server/metaAds.ts",
  "server/routers.ts",
  "README.md",
  "plan.md",
];

const MAX_PATCH_LENGTH = 250_000;

async function requireEditor(req: Request, res: Response) {
  if (await isEditorSession(getEditorSessionToken(req))) return true;
  res.status(401).json({ error: "Editor authentication required" });
  return false;
}

export function registerEditorRoutes(app: Express) {
  app.post("/api/editor/login", async (req, res) => {
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!editorPasswordMatches(password)) {
      return res.status(401).json({ error: "Contraseña del editor incorrecta" });
    }
    setEditorSession(res, await createEditorSession());
    return res.json({ ok: true });
  });

  app.post("/api/editor/logout", (_req, res) => {
    clearEditorSession(res);
    return res.json({ ok: true });
  });

  app.get("/api/editor/session", async (req, res) => {
    return res.json({ authenticated: await isEditorSession(getEditorSessionToken(req)) });
  });

  app.get("/api/editor/files", async (req, res) => {
    if (!(await requireEditor(req, res))) return;
    return res.json({
      mode: "proposal-only",
      allowedPaths: EDITOR_ALLOWED_PATHS,
      restrictions: [
        "No permite leer secretos, variables de entorno ni la base de datos.",
        "No permite modificar autenticación, migraciones, dependencias, Dockerfile ni despliegue.",
        "Cada cambio se guarda como propuesta para revisión y publicación controlada.",
      ],
    });
  });

  app.get("/api/editor/proposals", async (req, res) => {
    if (!(await requireEditor(req, res))) return;
    return res.json({ proposals: await listEditorProposals() });
  });

  app.post("/api/editor/proposals", async (req, res) => {
    if (!(await requireEditor(req, res))) return;
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const filePath = typeof req.body?.filePath === "string" ? req.body.filePath.trim() : "";
    const patch = typeof req.body?.patch === "string" ? req.body.patch : "";
    const submittedBy = typeof req.body?.submittedBy === "string" ? req.body.submittedBy.trim() : "Editor restringido";
    if (!title || title.length > 180) return res.status(400).json({ error: "Título inválido" });
    if (!EDITOR_ALLOWED_PATHS.includes(filePath)) return res.status(400).json({ error: "Archivo no permitido por el editor restringido" });
    if (!patch || patch.length > MAX_PATCH_LENGTH) return res.status(400).json({ error: "La propuesta debe contener un patch válido" });
    const id = await createEditorProposal({ title, filePath, patch, submittedBy: submittedBy.slice(0, 180) });
    return res.status(201).json({ ok: true, id, status: "proposed" });
  });
}
