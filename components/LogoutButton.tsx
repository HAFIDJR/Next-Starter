"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  email: string;
};

export default function LogoutButton({ email }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logout() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });

      if (!response.ok) {
        throw new Error("Could not sign out. Please try again.");
      }

      router.replace("/login");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not sign out.");
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-40 truncate text-xs text-slate-500 sm:block">
        {email}
      </span>
      <button
        aria-label="Sign out"
        className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
        disabled={pending}
        onClick={logout}
        type="button"
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
      {error && (
        <span className="sr-only" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
