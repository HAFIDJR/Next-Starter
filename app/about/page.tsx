import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About · Taskly",
  description: "Learn about this Next.js App Router starter.",
};

const stack = [
  {
    name: "Next.js",
    role: "App Router, Server & Client Components, Route Handlers",
  },
  { name: "Drizzle ORM", role: "Typed database schema and queries" },
  { name: "PostgreSQL", role: "Relational data store for tasks" },
  { name: "Tailwind CSS", role: "Utility-first styling" },
];

export default function AboutPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
        About this starter
      </h1>
      <p className="mt-4 text-base leading-relaxed text-slate-600">
        Taskly demonstrates the idiomatic structure of a modern{" "}
        <span className="font-semibold text-slate-900">Next.js App Router</span>{" "}
        project. The home page is a Server Component that queries the database
        directly, while interactive controls live in Client Components that talk
        to typed Route Handlers under{" "}
        <code className="rounded bg-slate-200 px-1.5 py-0.5 text-sm">
          /api/tasks
        </code>
        .
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {stack.map((item) => (
          <div
            key={item.name}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-lg font-semibold text-slate-900">
              {item.name}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{item.role}</p>
          </div>
        ))}
      </div>
      <p className="mt-8 rounded-2xl bg-indigo-50 p-4 text-sm text-indigo-700">
        ✨ Add tasks from the Tasks page to see data flow from the browser,
        through an API route, into PostgreSQL — and back rendered by the server.
      </p>
    </main>
  );
}
