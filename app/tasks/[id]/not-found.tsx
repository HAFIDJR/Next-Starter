// app/tasks/[id]/not-found.tsx
import Link from "next/link";

export default function TaskNotFound() {
  return (
    <main className="mx-auto w-full max-w-2xl p-6 text-center">
      <h1 className="text-lg font-semibold text-slate-900">Task not found</h1>
      <p className="mt-2 text-sm text-slate-500">
        It may have been deleted or the URL is wrong.
      </p>
      <Link href="/" className="mt-4 inline-block text-sm text-slate-900 underline">
        Back to tasks
      </Link>
    </main>
  );
}