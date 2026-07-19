import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Clem" }] }),
  component: LoginPage,
});

type Mode = "signin" | "signup" | "reset";

function LoginPage() {
  const { signIn, signUp, resetPassword, user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Already signed in → redirect home
  if (user) {
    void navigate({ to: "/" });
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (mode === "reset") {
      const result = await resetPassword(email);
      setLoading(false);
      setError(result.error ?? "Check your email for a reset link.");
      return;
    }
    const result =
      mode === "signin" ? await signIn(email, password) : await signUp(email, password, firstName, lastName);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else if (mode === "signup") {
      setError("Check your email to confirm your account, then sign in.");
    } else {
      void navigate({ to: "/" });
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 font-serif text-3xl tracking-tight text-foreground">Clem</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          {mode === "reset" ? "Reset your password" : "Your digital closet"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-widest">
                  First name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  autoComplete="given-name"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Jane"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-widest">
                  Last name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  autoComplete="family-name"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Doe"
                />
              </div>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-widest">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="you@example.com"
            />
          </div>
          {mode !== "reset" && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-widest">
                  Password
                </label>
                {mode === "signin" && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline underline-offset-2"
                    onClick={() => { setMode("reset"); setError(null); }}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="••••••••"
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "..." : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin" ? (
            <>
              No account?{" "}
              <button
                className="text-foreground underline underline-offset-2"
                onClick={() => { setMode("signup"); setError(null); }}
              >
                Sign up
              </button>
            </>
          ) : mode === "signup" ? (
            <>
              Already have one?{" "}
              <button
                className="text-foreground underline underline-offset-2"
                onClick={() => { setMode("signin"); setError(null); }}
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              Back to{" "}
              <button
                className="text-foreground underline underline-offset-2"
                onClick={() => { setMode("signin"); setError(null); }}
              >
                sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
