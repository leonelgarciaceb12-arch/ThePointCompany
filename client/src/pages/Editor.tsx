import { useEffect, useState, type FormEvent } from "react";
import { FileCode2, LockKeyhole, LogOut, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type Proposal = {
  id: number;
  title: string;
  filePath: string;
  status: string;
  submittedBy: string;
  createdAt: string;
};

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { ...init, credentials: "include", headers: { "content-type": "application/json", ...(init?.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "No se pudo completar la operación");
  return body as T;
}

export default function Editor() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [title, setTitle] = useState("");
  const [filePath, setFilePath] = useState("");
  const [patch, setPatch] = useState("");
  const [submittedBy, setSubmittedBy] = useState("");
  const [busy, setBusy] = useState(false);

  const loadEditor = async () => {
    const [fileData, proposalData] = await Promise.all([
      requestJson<{ allowedPaths: string[] }>("/api/editor/files"),
      requestJson<{ proposals: Proposal[] }>("/api/editor/proposals"),
    ]);
    setFiles(fileData.allowedPaths);
    setFilePath(current => current || fileData.allowedPaths[0] || "");
    setProposals(proposalData.proposals);
  };

  useEffect(() => {
    requestJson<{ authenticated: boolean }>("/api/editor/session")
      .then(data => {
        setAuthenticated(data.authenticated);
        if (data.authenticated) loadEditor().catch(error => toast.error(error.message));
      })
      .catch(() => setAuthenticated(false));
  }, []);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await requestJson("/api/editor/login", { method: "POST", body: JSON.stringify({ password }) });
      setPassword("");
      setAuthenticated(true);
      await loadEditor();
      toast.success("Editor habilitado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo ingresar");
    } finally {
      setBusy(false);
    }
  };

  const submitProposal = async (event: FormEvent) => {
    event.preventDefault();
    if (!title || !filePath || !patch) return;
    setBusy(true);
    try {
      await requestJson("/api/editor/proposals", { method: "POST", body: JSON.stringify({ title, filePath, patch, submittedBy }) });
      setTitle("");
      setPatch("");
      await loadEditor();
      toast.success("Propuesta guardada para revisión");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la propuesta");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await requestJson("/api/editor/logout", { method: "POST" });
    setAuthenticated(false);
    setProposals([]);
  };

  if (authenticated === null) return <main className="editor-screen"><section className="editor-card"><p>Verificando editor…</p></section></main>;
  if (!authenticated) {
    return (
      <main className="editor-screen">
        <section className="editor-card editor-login-card">
          <div className="editor-brand"><span className="editor-mark"><LockKeyhole size={19} /></span><span>THE POINT EDITOR</span></div>
          <h1>Editor restringido</h1>
          <p>Acceso exclusivo para proponer cambios de código. No expone secretos, base de datos ni terminal.</p>
          <form onSubmit={login} className="editor-form">
            <label>Contraseña del editor<input autoFocus type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Contraseña exclusiva" /></label>
            <button className="button primary" disabled={!password || busy}><LockKeyhole size={16} />{busy ? "Validando…" : "Entrar al editor"}</button>
          </form>
          <small>Este acceso es distinto de la contraseña del tablero.</small>
        </section>
      </main>
    );
  }

  return (
    <main className="editor-screen editor-workspace">
      <header className="editor-header">
        <div><div className="editor-brand"><span className="editor-mark"><FileCode2 size={19} /></span><span>THE POINT EDITOR</span></div><h1>Propuestas de código</h1></div>
        <button className="button secondary" onClick={logout}><LogOut size={16} /> Salir</button>
      </header>
      <div className="editor-grid">
        <section className="editor-card">
          <div className="editor-section-heading"><div><span className="eyebrow">modo seguro</span><h2>Nueva propuesta</h2></div><ShieldCheck size={20} /></div>
          <p className="editor-help">Pegá un patch unificado para que un operador o IA lo revise. El editor no publica automáticamente ni puede tocar archivos sensibles.</p>
          <form onSubmit={submitProposal} className="editor-form">
            <label>Título<input value={title} onChange={event => setTitle(event.target.value)} placeholder="Ej. Mejorar tabla de ventas" /></label>
            <label>Archivo permitido<select value={filePath} onChange={event => setFilePath(event.target.value)}>{files.map(file => <option key={file} value={file}>{file}</option>)}</select></label>
            <label>Operador o IA<input value={submittedBy} onChange={event => setSubmittedBy(event.target.value)} placeholder="Opcional" /></label>
            <label>Patch o propuesta<textarea value={patch} onChange={event => setPatch(event.target.value)} rows={15} placeholder="Pegá aquí el patch unificado…" /></label>
            <button className="button primary" disabled={busy || !title || !patch}><Send size={16} />{busy ? "Guardando…" : "Guardar propuesta"}</button>
          </form>
        </section>
        <section className="editor-card">
          <div className="editor-section-heading"><div><span className="eyebrow">historial</span><h2>Propuestas recientes</h2></div><span className="editor-count">{proposals.length}</span></div>
          <div className="editor-proposals">{proposals.length ? proposals.map(proposal => <article key={proposal.id}><div><strong>{proposal.title}</strong><small>{proposal.filePath} · {proposal.submittedBy || "Editor restringido"}</small></div><span className={`editor-status ${proposal.status}`}>{proposal.status}</span></article>) : <p className="muted">Todavía no hay propuestas.</p>}</div>
          <div className="editor-rules"><strong>Restricciones activas</strong><span>Sin secretos ni .env</span><span>Sin base de datos directa</span><span>Sin terminal ni publicación automática</span><span>Archivos allowlist únicamente</span></div>
        </section>
      </div>
    </main>
  );
}
