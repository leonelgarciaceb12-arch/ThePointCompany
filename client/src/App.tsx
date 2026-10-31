import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import { useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "./lib/trpc";

function SharedAccess() {
  const [password, setPassword] = useState("");
  const auth = trpc.auth.me.useQuery(undefined, { retry: false, staleTime: 0 });
  const utils = trpc.useUtils();
  const login = trpc.auth.sharedLogin.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      toast.success("Acceso habilitado");
    },
    onError: error => toast.error(error.message || "No se pudo validar la contraseña"),
  });
  if (auth.isLoading) return <div className="access-screen"><div className="access-card"><span className="access-kicker">THE POINT COMPANY</span><p>Verificando acceso…</p></div></div>;
  if (auth.data) return <Home />;

  return (
    <main className="access-screen">
      <section className="access-card">
        <div className="access-mark">·</div>
        <span className="access-kicker">THE POINT COMPANY</span>
        <h1>Control de negocio</h1>
        <p>Ingresá la contraseña compartida para continuar con el tablero.</p>
        <form onSubmit={event => { event.preventDefault(); if (password) login.mutate({ password }); }}>
          <label className="access-field">
            <span>Contraseña</span>
            <div className="access-input-wrap"><LockKeyhole size={17} /><input autoFocus type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Ingresá la contraseña" /></div>
          </label>
          <button className="button primary access-submit" disabled={!password || login.isPending}>
            {login.isPending ? "Validando…" : "Entrar al sistema"}<ArrowRight size={17} />
          </button>
        </form>
        <small className="access-note">Acceso privado para los socios · datos sincronizados en la nube</small>
      </section>
    </main>
  );
}

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={SharedAccess} />
      <Route path={"/acceso"} component={SharedAccess} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
