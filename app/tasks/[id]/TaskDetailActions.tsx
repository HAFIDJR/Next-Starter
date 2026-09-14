"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteRequest, jsonRequest } from "@/src/lib/api-client";
import type { TaskDto } from "@/src/features/tasks/types";

export default function TaskDetailActions({ task }: { task: TaskDto }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);

    try {
      await jsonRequest<TaskDto>(
        `/api/tasks/${task.id}`,
        "PATCH",
        { completed: !task.completed },
        "Could not update task.",
      );
      router.refresh(); // re-runs the Server Component with fresh data
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Soft delete, same as the list: the row keeps its id in the trash, so landing
   * back on `/` with `?trash=1` can still win it back.
   */
  async function moveToTrash() {
    if (!confirm("Move this task to the trash?")) return;

    setBusy(true);
    setError(null);

    try {
      await deleteRequest(`/api/tasks/${task.id}`, "Could not move task to trash.");
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
        <div className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-2.5 text-xs font-medium text-danger">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/"
          className="rounded-xl border border-line px-4 py-2 text-xs font-medium text-muted transition hover:bg-sunken hover:text-ink"
        >
          ← Back
        </Link>
        <button
          onClick={toggle}
          disabled={busy}
          className="rounded-xl bg-ink px-4 py-2 text-xs font-medium text-[var(--canvas)] transition hover:opacity-90 disabled:opacity-40"
        >
          {task.completed ? "Mark as pending" : "Mark as done"}
        </button>
        <button
          onClick={moveToTrash}
          disabled={busy}
          className="ml-auto rounded-xl border border-danger/30 px-4 py-2 text-xs font-medium text-danger transition hover:bg-danger-soft disabled:opacity-40"
        >
          Move to Trash
        </button>
      </div>
    </div>
  );
}
