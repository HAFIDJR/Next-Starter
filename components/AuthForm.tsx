"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { credentialsSchema } from "@/src/features/auth/validation";

type AuthMode = "login" | "register";
type FieldErrors = Partial<Record<"email" | "password", string>>;

type Props = {
  mode: AuthMode;
  nextPath?: string;
};

function getSafeNextPath(nextPath?: string): string {
  if (
    !nextPath ||
    !nextPath.startsWith("/") ||
    nextPath.startsWith("//") ||
    nextPath.startsWith("/\\") ||
    nextPath.startsWith("/login") ||
    nextPath.startsWith("/register")
  ) {
    return "/";
  }

  return nextPath;
}

export default function AuthForm({ mode, nextPath }:Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isLogin = mode === "login";
  const redirectPath = getSafeNextPath(nextPath);
  const alternateHref =
    redirectPath === "/"
      ? isLogin
        ? "/register"
        : "/login"
      : `${isLogin ? "/register" : "/login"}?next=${encodeURIComponent(redirectPath)}`;

  function clearError(field: keyof FieldErrors) {
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const result = credentialsSchema.safeParse({ email, password });

    if (!result.success) {
      const fieldErrors: FieldErrors = {};

      for (const issue of result.error.issues) {
        const field = issue.path[0];

        if (
          (field === "email" || field === "password") &&
          !fieldErrors[field]
        ) {
          fieldErrors[field] = issue.message;
        }
      }

      setErrors(fieldErrors);
      return;
    }

    setPending(true);
    setErrors({});

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        if (
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof payload.error === "string"
        ) {
          setFormError(payload.error);
        } else {
          setFormError("Could not complete your request. Please try again.");
        }
        return;
      }

      router.replace(redirectPath);
      router.refresh();
    } catch {
      setFormError("Could not connect to the server. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-65px)] w-full max-w-md items-center px-4 py-12 sm:px-6">
      <section className="w-full rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
        <p className="text-sm font-medium uppercase tracking-widest text-accent">
          Taskly
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">
          {isLogin ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          {isLogin
            ? "Sign in to access your private task workspace."
            : "Create an account to keep your tasks private."}
        </p>

        <form className="mt-7 space-y-5" noValidate onSubmit={submit}>
          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-ink"
              htmlFor="email"
            >
              Email address
            </label>
            <input
              autoComplete="email"
              id="email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                clearError("email");
              }}
              aria-describedby={errors.email ? "email-error" : undefined}
              aria-invalid={Boolean(errors.email)}
              className={`w-full rounded-xl border px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-faint focus:ring-2 ${
                errors.email
                  ? "border-danger/60 focus:border-danger focus:ring-danger/20"
                  : "border-line focus:border-accent focus:ring-accent/20"
              }`}
              placeholder="you@example.com"
            />
            {errors.email && (
              <p id="email-error" role="alert" className="mt-1.5 text-xs text-danger">
                {errors.email}
              </p>
            )}
          </div>

          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-ink"
              htmlFor="password"
            >
              Password
            </label>
            <input
              autoComplete={isLogin ? "current-password" : "new-password"}
              id="password"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                clearError("password");
              }}
              aria-describedby={errors.password ? "password-error" : "password-help"}
              aria-invalid={Boolean(errors.password)}
              className={`w-full rounded-xl border px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-faint focus:ring-2 ${
                errors.password
                  ? "border-danger/60 focus:border-danger focus:ring-danger/20"
                  : "border-line focus:border-accent focus:ring-accent/20"
              }`}
              placeholder="••••••••"
            />
            {errors.password ? (
              <p id="password-error" role="alert" className="mt-1.5 text-xs text-danger">
                {errors.password}
              </p>
            ) : (
              <p id="password-help" className="mt-1.5 text-xs text-muted">
                Use at least 8 characters, including a letter and a number.
              </p>
            )}
          </div>

          {formError && (
            <p
              role="alert"
              className="rounded-xl border border-danger/25 bg-danger-soft px-3 py-2.5 text-sm text-danger"
            >
              {formError}
            </p>
          )}

          <button
            className="w-full rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-[var(--canvas)] transition hover:opacity-90 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50"
            disabled={pending}
            type="submit"
          >
            {pending
              ? isLogin
                ? "Signing in…"
                : "Creating account…"
              : isLogin
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {isLogin ? "New to Taskly?" : "Already have an account?"}{" "}
          <Link
            className="font-semibold text-accent hover:text-accent"
            href={alternateHref}
          >
            {isLogin ? "Create an account" : "Sign in"}
          </Link>
        </p>
      </section>
    </main>
  );
}
