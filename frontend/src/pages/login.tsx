import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** Faint topographic contour lines — a nod to land survey sheets. */
function Contours() {
  return (
    <svg className="absolute inset-0 h-full w-full opacity-[0.09]" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <g fill="none" stroke="#e8d9a8" strokeWidth="1">
        {Array.from({ length: 14 }).map((_, i) => (
          <path
            key={i}
            d={`M-50 ${120 + i * 48} C 120 ${60 + i * 52}, 220 ${210 + i * 40}, 360 ${150 + i * 46} S 560 ${90 + i * 50}, 680 ${170 + i * 44}`}
          />
        ))}
        <ellipse cx="430" cy="560" rx="60" ry="34" />
        <ellipse cx="430" cy="560" rx="96" ry="58" />
        <ellipse cx="430" cy="560" rx="134" ry="84" />
      </g>
    </svg>
  );
}

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/";
  if (user) return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err, "Sign-in failed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="relative hidden overflow-hidden bg-forest-900 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Contours />
        <div className="relative flex items-center gap-3">
          <img src="/logo.jpg" alt="Ministry of Lands and Rural Development" className="size-14 rounded-full bg-white p-0.5" />
          <div className="leading-tight text-white">
            <p className="text-[14px] font-semibold">Ministry of Lands and Rural Development</p>
            <p className="text-[12.5px] text-white/60">Republic of Zimbabwe</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <p className="mb-4 font-mono text-[11.5px] uppercase tracking-[0.18em] text-gold">
            Land Reform & Resettlement · Phase II · Model A2
          </p>
          <h1 className="text-[34px] font-semibold leading-[1.12] tracking-[-0.02em] text-white">
            Commercial Farm Settlement Scheme registry
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-white/65">
            Capture applications, file supporting documents and record decisions from the Chief Land Officer through to the
            Minister, under the Agricultural Land Settlement Act (Chapter 20:01).
          </p>
        </div>

        <p className="relative text-[12px] italic text-white/45">“Rooted in our land, building our future.”</p>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[360px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src="/logo.jpg" alt="" className="size-12 rounded-full" />
            <p className="text-[13px] font-semibold leading-tight">
              Ministry of Lands and
              <br />
              Rural Development
            </p>
          </div>

          <h2 className="text-[20px] font-semibold tracking-tight">Officer sign in</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">Use the credentials issued by your system administrator.</p>

          <form onSubmit={onSubmit} className="mt-7 grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-9"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-[12.5px] text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" disabled={busy} className="mt-1">
              {busy ? <Loader2 className="animate-spin" /> : null}
              Sign in
              {!busy && <ArrowRight />}
            </Button>
          </form>

          <p className="mt-10 border-t pt-4 text-[11.5px] leading-relaxed text-muted-foreground">
            Application contents are confidential. Access is logged and restricted to authorised Ministry officers.
          </p>
        </div>
      </div>
    </div>
  );
}

