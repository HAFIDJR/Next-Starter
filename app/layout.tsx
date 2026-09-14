import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

import "./globals.css";
import LogoutButton from "@/components/LogoutButton";
import PreferencesControls from "@/components/PreferencesControls";
import { getCurrentUser } from "@/src/features/auth/session";
import {
  documentClassForPreferences,
  documentDataAttributesForPreferences,
  getPreferences,
} from "@/src/features/preferences/read";
import { PREFERENCES_SCRIPT } from "@/src/features/preferences/script";

export const metadata: Metadata = {
  title: "Tasks · Next.js App Router",
  description:
    "A private task manager built with the Next.js App Router, Drizzle, and PostgreSQL.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f5f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

const navLinks = [
  { href: "/", label: "Tasks" },
  { href: "/about", label: "About" },
];

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [user, preferences] = await Promise.all([
    getCurrentUser(),
    getPreferences(),
  ]);

  return (
    <html
      lang="en"
      className={documentClassForPreferences(preferences)}
      {...documentDataAttributesForPreferences(preferences)}
      // The pre-paint script owns these two attributes as well.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFERENCES_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-canvas text-ink antialiased">
        <header className="border-b border-line bg-surface/80 backdrop-blur">
          <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-4 sm:px-6">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm font-semibold text-ink"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-base text-[var(--accent-contrast)]">
                ✓
              </span>
              Taskly
            </Link>
            <div className="flex items-center gap-1 text-sm">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-3 py-2 font-medium text-muted transition hover:bg-sunken hover:text-ink"
                >
                  {link.label}
                </Link>
              ))}

              <PreferencesControls initial={preferences} />

              {user ? (
                <LogoutButton email={user.email} />
              ) : (
                <Link
                  href="/login"
                  className="rounded-lg px-3 py-2 font-medium text-accent transition hover:bg-accent-soft"
                >
                  Sign in
                </Link>
              )}
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
