"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useCallback,
  type FormEvent,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import TaskFilters from "./TaskFilters";
import TaskItem, { type TaskPatch } from "./TaskItem";
import UndoToast, { type ToastState } from "./UndoToast";

import { ApiError, deleteRequest, jsonRequest } from "@/src/lib/api-client";
import { describeDue, parseDueText } from "@/src/features/tasks/due-date";
import { UNDO_TOAST_DURATION_MS } from "@/src/features/tasks/constansts";
import type { TaskDto, TaskListFilters } from "@/src/features/tasks/types";
import {
  buildTaskListQuery,
  createTaskSchema,
} from "@/src/features/tasks/validation";

type Props = {
  initialTasks: TaskDto[];
  filters: TaskListFilters;
  timeZone: string;
  now: Date;
  trashCount: number;
};

function messageFrom(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.message;
  }

  return error instanceof Error ? error.message : fallback;
}

function signatureOf(tasks: TaskDto[]) {
  return tasks
    .map((task) => `${task.id}:${task.updatedAt.getTime()}`)
    .join("|");
}

export default function TaskManager({
  initialTasks,
  filters,
  timeZone,
  now,
  trashCount,
}: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskDto[]>(initialTasks);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editor, setEditor] = useState<{
    taskId: number;
    viewKey: string;
  } | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [toastPaused, setToastPaused] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const toastId = useRef(0);

  const busy = pendingCount > 0;

  const viewKey = `${filters.q}::${filters.filter}::${filters.trash ? "trash" : "list"}`;
  const editingId = editor?.viewKey === viewKey ? editor.taskId : null;

  const signature = signatureOf(initialTasks);
  const appliedSignature = useRef(signature);

  useEffect(() => {
    if (pendingCount > 0) {
      return;
    }

    if (appliedSignature.current === signature) {
      return;
    }

    appliedSignature.current = signature;
    setTasks(initialTasks);
  }, [signature, pendingCount, initialTasks]);

  useEffect(() => {
    if (!error) {
      return;
    }

    const timer = setTimeout(() => {
      setError(null);
    }, 4000);

    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = setTimeout(() => setToast(null), toast.durationMs);

    return () => clearTimeout(timer);
  }, [toast, toastPaused]);

  const begin = useCallback(() => setPendingCount((count) => count + 1), []);
  const end = useCallback(
    () => setPendingCount((count) => Math.max(0, count - 1)),
    [],
  );

  function pushToast(
    message: string,
    action?: ToastState["action"],
    actionLabel = "Undo",
  ) {
    const next: ToastState = {
      id: toastId.current,
      message,
      durationMs: UNDO_TOAST_DURATION_MS,
    };

    if (action) {
      next.action = action;
      next.actionLabel = actionLabel;
    }

    setToast(next);
  }

  const preview = useMemo(() => {
    const text = draft.trim();

    if (!text) {
      return null;
    }

    const parsed = parseDueText(text, { now, timeZone });

    if (!parsed.dueAt) {
      return null;
    }

    const description = describeDue(parsed.dueAt, { now, timeZone });
    return {
      title: parsed.title,
      label: description?.text ?? "",
      tone: description?.tone ?? "future",
    };
  }, [draft, now, timeZone]);

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
    }
  }, [editingId]);

  async function addTask(event: FormEvent) {
    event.preventDefault();

    if (adding || busy) {
      return;
    }

    const result = createTaskSchema.safeParse({ draft: draft.trim() });
    if (!result.success) {
      setDraftError(result.error.issues[0]?.message ?? "Enter a valid task.");
      return;
    }

    setAdding(true);
    setDraftError(null);
    setError(null);
    begin();

    try {
      const created = await jsonRequest<TaskDto>(
        "/api/tasks",
        "POST",
        { draft: draft.trim() },
        "Could not add task.",
      );

      setDraft("");
      setTasks((previous) =>
        previous.some((task) => task.id === created.id)
          ? previous
          : [created, ...previous],
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setAdding(false);
      end();
    }
  }

  async function patchTask(
    id: number,
    body: Record<string, unknown>,
    optimistic: Partial<TaskDto>,
    fallback: string,
  ) {
    const snapshot = tasks;
    setTasks((previous) =>
      previous.map((task) =>
        task.id === id ? { ...task, ...optimistic } : task,
      ),
    );
    setError(null);
    begin();

    try {
      const updated = await jsonRequest<TaskDto>(
        `/api/tasks/${id}`,
        "PATCH",
        body,
        fallback,
      );

      router.refresh();
      return updated;
    } catch (caught) {
      setTasks(snapshot);
      setError(messageFrom(caught, fallback));
      return null;
    } finally {
      end();
    }
  }

  async function toggle(task: TaskDto) {
    const completed = !task.completed;

    const updated = await patchTask(
      task.id,
      { completed },
      { completed },
      "COuld Not update task",
    );

    if (updated && updated?.completed) {
      pushToast(`“${updated.title}” is done.`, () => {
        void patchTask(
          updated.id,
          { completed: false },
          { completed: false },
          "Could not update task.",
        );
      });
    }
  }

  async function saveEdit(id: number, patch: TaskPatch) {
    const updated = await patchTask(
      id,
      {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        ...(patch.dueAt !== undefined ? { dueAt: patch.dueAt } : {}),
      },
      {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        ...(patch.dueAt !== undefined
          ? { dueAt: patch.dueAt ? new Date(patch.dueAt) : null }
          : {}),
      },
      "Could not update task.",
    );

    if (!updated) {
      return false;
    }

    setTasks((previous) =>
      previous.map((task) => (task.id === id ? updated : task)),
    );

    return true;
  }

  async function moveToTrash(task: TaskDto) {
    const snapshot = tasks;
    setTasks((previous) => previous.filter((entry) => entry.id !== task.id));
    setError(null);
    begin();

    try {
      await deleteRequest(
        `/api/tasks/${task.id}`,
        "Could not move task to trash.",
      );
      pushToast(`“${task.title}” moved to Trash.`, () => restore(task.id));
      router.refresh();
    } catch (caught) {
      setTasks(snapshot);
      setError(messageFrom(caught, "Could not move task to trash."));
    } finally {
      end();
    }
  }

  async function restore(taskId: number) {
    setError(null);
    begin();

    try {
      const restored = await jsonRequest<TaskDto>(
        `/api/tasks/${taskId}/restore`,
        "POST",
        {},
        "Could not restore task.",
      );

      setToast(null);
      setTasks((previous) =>
        previous.some((task) => task.id === restored.id)
          ? previous
          : [restored, ...previous],
      );
      router.refresh();
    } catch (caught) {
      setError(messageFrom(caught, "Could not restore task."));
    } finally {
      end();
    }
  }

  async function deleteForever(task: TaskDto) {
    const snapshot = tasks;
    setTasks((previous) => previous.filter((entry) => entry.id !== task.id));

    setError(null);
    begin();

    try {
      await deleteRequest(
        `/api/tasks/${task.id}?permanent=1`,
        "Could not delete task.",
      );
      pushToast(`“${task.title}” deleted for good.`);
      router.refresh();
    } catch (caught) {
      setTasks(snapshot);
      setError(messageFrom(caught, "Could not delete task."));
    } finally {
      end();
    }
  }

  function dismissToast() {
    setToast(null);
    setToastPaused(false);
  }

  const remaining = tasks.filter((task) => !task.completed).length;
  const done = tasks.length - remaining;
  const overdue = tasks.filter((task) => {
    const description = describeDue(task.dueAt, {
      now,
      timeZone,
      completed: task.completed,
    });

    return description?.tone === "overdue";
  }).length;
  const filtering =
    filters.q !== "" || filters.filter !== "all" || filters.trash;
  const hrefFor = (next: TaskListFilters) => `/${buildTaskListQuery(next)}`;
  const overdueHref = hrefFor({ ...filters, filter: "overdue", trash: false });

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {!filters.trash ? (
        <div className="w-full space-y-1.5">
          <form
            noValidate
            onSubmit={addTask}
            className={`group relative flex items-center gap-2 rounded-2xl border bg-surface/80 p-1.5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] backdrop-blur-md transition-all focus-within:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] ${
              draftError
                ? "border-danger focus-within:border-danger"
                : "border-line focus-within:border-accent"
            }`}
          >
            <div className="pointer-events-none pl-3 text-faint">
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
            <label className="sr-only" htmlFor="new-task-title">
              Task title
            </label>
            <input
              id="new-task-title"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                if (draftError) {
                  setDraftError(null);
                }
              }}
              maxLength={160}
              aria-invalid={Boolean(draftError)}
              aria-describedby={
                draftError ? "new-task-title-error" : "new-task-title-hint"
              }
              placeholder="What needs to be done?  Try: email the client friday 9am"
              className="flex-1 bg-transparent px-2 py-2 text-sm text-ink placeholder:text-faint focus:outline-none"
            />
            <button
              type="submit"
              disabled={adding || busy}
              className="inline-flex items-center justify-center rounded-xl bg-ink px-4 py-2 text-xs font-medium tracking-wide text-canvas transition-all hover:opacity-90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
            >
              {adding ? "Adding…" : "Add task"}
            </button>
          </form>

          {draftError ? (
            <p
              id="new-task-title-error"
              role="alert"
              className="px-2 text-xs font-medium text-danger"
            >
              {draftError}
            </p>
          ) : (
            <p id="new-task-title-hint" className="px-2 text-[11px] text-faint">
              {preview ? (
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-ink">
                    “{preview.title}”
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 font-medium ${
                      preview.tone === "overdue"
                        ? "border-danger/30 bg-danger-soft text-danger"
                        : preview.tone === "today"
                          ? "border-warning/30 bg-warning-soft text-warning"
                          : "border-accent/25 bg-accent-soft text-accent"
                    }`}
                  >
                    {preview.label}
                  </span>
                  <span>
                    — due dates are parsed on the server too, so this is only a
                    preview.
                  </span>
                </span>
              ) : (
                <span>
                  Dates work inline:{" "}
                  <code className="font-mono text-[10px]">tomorrow</code>,{" "}
                  <code className="font-mono text-[10px]">fri 9am</code>,{" "}
                  <code className="font-mono text-[10px]">in 3d</code>,{" "}
                  <code className="font-mono text-[10px]">20/9</code>.
                </span>
              )}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-danger/25 bg-danger-soft px-4 py-3 text-xs text-danger">
          <p className="font-semibold">Trash</p>
          <p className="mt-0.5 text-danger/80">
            Deleted tasks stay here for 30 days, then are removed automatically.
            Restore one, or delete it for good.
          </p>
        </div>
      )}

      <TaskFilters filters={filters} trashCount={trashCount} />
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-2.5 text-xs font-medium text-danger backdrop-blur-sm"
        >
          {error}
        </div>
      ) : null}

      {filtering ? (
        <div className="flex items-center justify-between gap-2 px-1 text-[11px]">
          <span className="font-medium text-muted">
            {tasks.length} {tasks.length === 1 ? "result" : "results"}
            {filters.trash ? " in trash" : ""}
            {filters.q ? ` for “${filters.q}”` : ""}
          </span>
          <Link
            href="/"
            className="rounded-lg px-2 py-1 font-medium text-accent transition hover:bg-accent-soft"
          >
            Clear filters
          </Link>
        </div>
      ) : (
        <div className="space-y-2 px-1">
          <div className="flex items-center justify-between text-xs tracking-tight">
            <span className="font-medium text-muted">
              <strong className="font-semibold text-ink">{remaining}</strong>{" "}
              remaining
            </span>
            <span className="flex items-center gap-2 font-medium text-faint">
              {overdue > 0 && filters.filter !== "overdue" ? (
                <Link
                  href={overdueHref}
                  className="rounded-full border border-danger/30 bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger transition hover:border-danger"
                >
                  {overdue} overdue
                </Link>
              ) : null}
              <span>
                {tasks.length === 0
                  ? "0%"
                  : `${Math.round((done / tasks.length) * 100)}% done`}
              </span>
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-sunken">
            <div
              className="h-full bg-accent transition-all duration-500 ease-out"
              style={{
                width: `${tasks.length ? (done / tasks.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      <ul className="space-y-(--list-gap)">
        {tasks.length === 0 ? (
          <li className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line py-12 text-center text-xs text-faint">
            <span>
              {filters.trash
                ? "Trash is empty"
                : filters.q
                  ? "No tasks match that search"
                  : filters.filter !== "all"
                    ? `Nothing in ${filters.filter}`
                    : "No tasks scheduled"}
            </span>
            <span className="mt-1 text-[11px] text-faint/80">
              {filters.trash
                ? "Deleted tasks show up here for 30 days."
                : filtering
                  ? "Clear the filters above to see everything."
                  : "Type above and press enter to add."}
            </span>
          </li>
        ) : null}
        {tasks.map((task) => (
          <TaskItem
            key={`${task.id}:${editingId === task.id ? "edit" : "view"}`}
            task={task}
            now={now}
            timeZone={timeZone}
            inTrash={filters.trash}
            isEditing={editingId === task.id}
            saving={savingId === task.id}
            onStartEdit={() => setEditor({ taskId: task.id, viewKey })}
            onCancelEdit={() => setEditor(null)}
            onSave={async (patch) => {
              setSavingId(task.id);
              try {
                return await saveEdit(task.id, patch);
              } finally {
                setSavingId(null);
              }
            }}
            onToggle={() => toggle(task)}
            onDelete={() => moveToTrash(task)}
            onRestore={() => restore(task.id)}
            onPermanentDelete={() => deleteForever(task)}
          />
        ))}
      </ul>

      <UndoToast
        toast={toast}
        onDismiss={dismissToast}
        onPause={() => setToastPaused(true)}
        onResume={() => setToastPaused(false)}
      />
    </div>
  );
}
