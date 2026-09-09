import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tasks · Next.js App Router",
  description: "A simple task manager built with the Next.js App Router, Drizzle, and PostgreSQL.",
};

const navLinks = [
  { href: "/", label: "Tasks" },
  { href: "/about", label: "About" },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased">
        <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm font-semibold text-slate-900"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-base text-white">
                ✓
              </span>
              Taskly
            </Link>
            <div className="flex items-center gap-1 text-sm">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-3 py-2 font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
