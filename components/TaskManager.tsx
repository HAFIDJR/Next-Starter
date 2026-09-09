"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Task } from "@/src/db/schema";

import {
  TASK_TITLE_MAX_LENGTH,
  taskTitleSchema,
} from "@/src/features/tasks/validation";

type Props = {
  initialTasks: Task[];
};

function getTitleError(value: string): string | null {
  const result = taskTitleSchema.safeParse(value);
  return result.success
    ? null
    : (result.error.issues[0]?.message ?? "Enter a valid task title.");
}

async function getApiErrorMessage(response: Response, fallback: string) {
  const payload: unknown = await response.json().catch(() => null);

  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return fallback;
}

export default function TaskManager({ initialTasks }: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editTitleError, setEditTitleError] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!error) return;

    const timer = setTimeout(() => {
      setError(null);
    }, 4000);

    return () => clearTimeout(timer);
  }, [error]);

  // Focus the edit input when entering edit mode
  useEffect(() => {
    if (editingId !== null) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingId]);

  function startEditing(task: Task) {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditTitleError(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditTitle("");
    setEditTitleError(null);
  }

  async function saveEdit(id: number) {
    // const trimmed = editTitle.trim();
    // if (!trimmed) return;
    const parsedTitle = taskTitleSchema.safeParse(editTitle);
    if (!parsedTitle.success) {
      setEditTitleError(getTitleError(editTitle));
      return;
    }

    const title = parsedTitle.data;

    // Skip network request if unchanged
    const currentTask = tasks.find((task) => task.id === id);
    if (currentTask && currentTask.title === title) {
      cancelEditing();
      return;
    }

    setSavingEdit(true);
    setEditTitleError(null);
    setError(null);

    // Optimistic update
    setTasks((previousTasks) =>
      previousTasks.map((task) => (task.id === id ? { ...task, title } : task)),
    );

    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(response, "Could not update task."),
        );
      }
      setEditingId(null);
      router.refresh();
    } catch (err) {
      if (currentTask) {
        setTasks((previousTasks) =>
          previousTasks.map((task) => (task.id === id ? currentTask : task)),
        );
      }
      setError(err instanceof Error ? err.message : "Something went wrong.");
      router.refresh();
    } finally {
      setSavingEdit(false);
    }
  }

  async function addTask(e: FormEvent) {
    e.preventDefault();
    if (busy) {
      return;
    }

    const parsedTitle = taskTitleSchema.safeParse(title);

    if (!parsedTitle.success) {
      setTitleError(getTitleError(title));
      return;
    }

    setBusy(true);
    setTitleError(null);
    setError(null);

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: parsedTitle.data }),
      });
      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(response, "Could not add task."),
        );
      }
      const created: Task = await response.json();
      setTasks((previousTasks) => [created, ...previousTasks]);
      setTitle("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: number, completed: boolean) {
    const previousTask = tasks.find((tasks) => tasks.id === id);
    setTasks((previousTasks) =>
      previousTasks.map((task) =>
        task.id === id ? { ...task, completed } : task,
      ),
    );
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(response, "Could not update task."),
        );
      }
      router.refresh();
    } catch (err) {
      if (previousTask) {
        setTasks((previousTasks) =>
          previousTasks.map((task) => (task.id === id ? previousTask : task)),
        );
      }
      setError(err instanceof Error ? err.message : "Something went wrong.");
      router.refresh();
    }
  }

  async function remove(id: number) {
    const deletedTaskIndex = tasks.findIndex((task) => task.id === id);
    const deletedTask = tasks[deletedTaskIndex];
    setTasks((previousTasks) => previousTasks.filter((task) => task.id !== id));
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${id}`, { method: "DELETE" });

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(response, "Could not delete task."),
        );
      }
      router.refresh();
    } catch (err) {
      if (deletedTask) {
        setTasks((previousTasks) => {
          if (previousTasks.some((task) => task.id === id)) {
            return previousTasks;
          }

          const restoredTasks = [...previousTasks];
          restoredTasks.splice(deletedTaskIndex, 0, deletedTask);
          return restoredTasks;
        });
      }
      setError(err instanceof Error ? err.message : "Something went wrong.");
      router.refresh();
    }
  }

  const remaining = tasks.filter((t) => !t.completed).length;
  const done = tasks.length - remaining;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Unified Input Bar */}
      <form
        onSubmit={addTask}
        className="group relative flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/80 p-1.5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] backdrop-blur-md transition-all focus-within:border-slate-400 focus-within:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)]"
      >
        <div className="pointer-events-none pl-3 text-slate-400">
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4v16m8-8H4"
            />
          </svg>
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs to be done?"
          className="flex-1 bg-transparent px-2 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-xs font-medium tracking-wide text-white transition-all hover:bg-slate-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
        >
          {busy ? "Adding…" : "Add task"}
        </button>
      </form>

      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50/70 px-4 py-2.5 text-xs font-medium text-rose-600 backdrop-blur-sm">
          {error}
        </div>
      )}

      {/* Visual Progress & Metrics */}
      <div className="space-y-2 px-1">
        <div className="flex items-center justify-between text-xs tracking-tight">
          <span className="font-medium text-slate-500">
            <strong className="font-semibold text-slate-900">
              {remaining}
            </strong>{" "}
            remaining
          </span>
          <span className="font-medium text-slate-400">
            {tasks.length === 0
              ? "0%"
              : `${Math.round((done / tasks.length) * 100)}% done`}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-slate-900 transition-all duration-500 ease-out"
            style={{
              width: `${tasks.length ? (done / tasks.length) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {/* Tasks List */}
      <ul className="space-y-2">
        {tasks.length === 0 && (
          <li className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-12 text-center text-xs text-slate-400">
            <span>No tasks scheduled</span>
            <span className="text-[11px] text-slate-300">
              Type above and press enter to add
            </span>
          </li>
        )}
        {tasks.map((task) => {
          const isEditing = editingId === task.id;

          return (
            <li
              key={task.id}
              className={`group flex items-center gap-3.5 rounded-2xl border bg-white/70 px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.02)] backdrop-blur-sm transition-all ${
                isEditing
                  ? "border-slate-400 ring-2 ring-slate-100"
                  : "border-slate-100 hover:border-slate-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)]"
              }`}
            >
              {/* Checkbox */}
              <button
                onClick={() => toggle(task.id, !task.completed)}
                disabled={isEditing}
                aria-label={
                  task.completed ? "Mark as not done" : "Mark as done"
                }
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition-all ${
                  task.completed
                    ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-400"
                } ${isEditing ? "opacity-30 pointer-events-none" : ""}`}
              >
                {task.completed && (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="h-3 w-3"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </button>

              {/* Title OR Inline Edit Input */}
              {isEditing ? (
                <div className="flex flex-1 items-center gap-1.5">
                  <input
                    ref={editInputRef}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(task.id);
                      if (e.key === "Escape") cancelEditing();
                    }}
                    disabled={savingEdit}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
                  />
                  {/* Save Edit Button */}
                  <button
                    onClick={() => saveEdit(task.id)}
                    disabled={savingEdit || !editTitle.trim()}
                    aria-label="Save task"
                    className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 active:scale-95 disabled:opacity-40"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="h-4 w-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </button>
                  {/* Cancel Edit Button */}
                  <button
                    onClick={cancelEditing}
                    disabled={savingEdit}
                    aria-label="Cancel editing"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:scale-95"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="h-4 w-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ) : (
                <>
                  <span
                    onDoubleClick={() => startEditing(task)}
                    className={`flex-1 text-sm transition-all ${
                      task.completed
                        ? "text-slate-400 line-through opacity-60"
                        : "text-slate-700"
                    }`}
                  >
                    {task.title}
                  </span>

                  {/* Date Meta */}
                  <span className="hidden text-[11px] font-medium tracking-tight text-slate-400 tabular-nums sm:block">
                    {new Date(task.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>

                  {/* Action Group */}
                  <div className="flex items-center gap-0.5 opacity-0 transition-all focus-within:opacity-100 group-hover:opacity-100">
                    {/* Edit Action Button */}

                    <button
                      onClick={() => router.push(`/tasks/${task.id}`)}
                      aria-label="View task details"
                      title="View details"
                      className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-blue-50 hover:text-blue-600 active:scale-95"
                    >
                      {/* Eye / open icon */}
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="h-3.5 w-3.5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    </button>

                    <button
                      onClick={() => startEditing(task)}
                      aria-label="Edit task"
                      className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="h-3.5 w-3.5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                        />
                      </svg>
                    </button>

                    {/* Delete Action Button */}
                    <button
                      onClick={() => remove(task.id)}
                      aria-label="Delete task"
                      className="rounded-lg p-1.5 text-slate-300 transition-all hover:bg-rose-50 hover:text-rose-500"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="h-3.5 w-3.5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
