"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TaskDto } from "@/src/features/tasks/types";

export default function TaskDetailActions({ task }: { task: TaskDto }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !task.completed }),
      });
      if (!res.ok) throw new Error("Could not update task.");
      router.refresh(); // re-runs the Server Component with fresh data
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this task?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete task.");
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50/70 px-4 py-2.5 text-xs font-medium text-rose-600">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Link
          href="/"
          className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          ← Back
        </Link>
        <button
          onClick={toggle}
          disabled={busy}
          className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-40"
        >
          {task.completed ? "Mark as pending" : "Mark as done"}
        </button>
        <button
          onClick={remove}
          disabled={busy}
          className="rounded-xl border border-rose-200 px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-40"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
