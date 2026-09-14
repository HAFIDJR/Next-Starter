"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  describeDue,
  toDateTimeLocalValue,
  type DueTone,
} from "@/src/features/tasks/due-date";
import { stripMarkdown } from "@/src/lib/markdown";
import type { TaskDto } from "@/src/features/tasks/types";
import {
  TASK_NOTES_MAX_LENGTH,
  taskTitleSchema,
} from "@/src/features/tasks/validation";
import { zonedDayStartPlus } from "@/src/lib/timezone";

export type TaskPatch = {
  title?: string;
  notes?: string | null;
  /** ISO string; `null` clears the due date. */
  dueAt?: string | null;
};

type Props = {
  task: TaskDto;
  now: Date;
  timeZone: string;
  inTrash: boolean;
  isEditing: boolean;
  saving: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (patch: TaskPatch) => Promise<boolean>;
  onToggle: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onPermanentDelete: () => void;
};

const TONE_CLASSES: Record<DueTone, string> = {
  overdue: "border-danger/30 bg-danger-soft text-danger",
  today: "border-warning/30 bg-warning-soft text-warning",
  soon: "border-accent/25 bg-accent-soft text-accent",
  future: "border-line bg-sunken text-muted",
};

const DAY_SHORTCUTS: Array<{ label: string; days: number }> = [
  { label: "Today", days: 0 },
  { label: "Tomorrow", days: 1 },
  { label: "Next week", days: 7 },
];

export default function TaskItem({
  task,
  now,
  timeZone,
  inTrash,
  isEditing,
  saving,
  onStartEdit,
  onCancelEdit,
  onSave,
  onToggle,
  onDelete,
  onRestore,
  onPermanentDelete,
}: Props) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [dueValue, setDueValue] = useState(
    toDateTimeLocalValue(task.dueAt, timeZone),
  );
  const [titleError, setTitleError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  // No reset effect: the parent keys this row by edit mode, so entering or
  // leaving the editor remounts it with fresh values from the server. That is the
  // React-recommended way to reset derived state (and it keeps
  // `react-hooks/set-state-in-effect` happy).

  const due = describeDue(task.dueAt, { now, timeZone, completed: task.completed });
  const notesPreview = task.notes ? stripMarkdown(task.notes) : "";

  function applyShortcut(days: number) {
    const dayStart = zonedDayStartPlus(now.getTime(), days, timeZone);
    // End of day, matching how the parser stores a date without a time.
    const stamp = new Date(dayStart + 23 * 60 * 60 * 1000 + 59 * 60 * 1000);

    setDueValue(toDateTimeLocalValue(stamp, timeZone));
  }

  async function submit() {
    const parsed = taskTitleSchema.safeParse(title);

    if (!parsed.success) {
      setTitleError(parsed.error.issues[0]?.message ?? "Enter a valid task title.");
      return;
    }

    setTitleError(null);

    const trimmedNotes = notes.trim();
    const nextDue = dueValue ? new Date(dueValue).toISOString() : null;
    const unchanged =
      parsed.data === task.title &&
      (trimmedNotes || null) === task.notes &&
      nextDue === (task.dueAt ? task.dueAt.toISOString() : null);

    if (unchanged) {
      onCancelEdit();
      return;
    }

    const ok = await onSave({
      title: parsed.data,
      notes: trimmedNotes.slice(0, TASK_NOTES_MAX_LENGTH) || null,
      dueAt: nextDue,
    });

    if (ok) {
      onCancelEdit();
    }
  }

  return (
    <li
      className={`group rounded-2xl border bg-surface/70 shadow-[0_1px_3px_rgba(0,0,0,0.02)] backdrop-blur-sm transition-all ${
        isEditing
          ? "border-line-strong ring-2 ring-sunken"
          : "border-line-soft hover:border-line hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)]"
      }`}
    >
      <div
        className="flex items-start gap-3 px-[var(--row-pad-x)] py-[var(--row-pad-y)]"
        style={{ fontSize: "var(--row-font)" }}
      >
        <button
          type="button"
          onClick={onToggle}
          disabled={isEditing || inTrash}
          aria-label={task.completed ? "Mark as not done" : "Mark as done"}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition-all ${
            task.completed
              ? "border-accent bg-accent text-[var(--accent-contrast)] shadow-sm"
              : "border-line-strong bg-surface hover:border-accent"
          } disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {task.completed ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3 w-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : null}
        </button>

        <div className="min-w-0 flex-1 space-y-1">
          {inTrash ? (
            <p className="font-medium text-muted line-through decoration-[var(--faint)]">
              {task.title}
            </p>
          ) : (
            <button
              type="button"
              onClick={onStartEdit}
              onDoubleClick={onStartEdit}
              className={`block w-full truncate text-left font-medium transition-all ${
                task.completed ? "text-faint line-through" : "text-ink"
              }`}
            >
              {task.title}
            </button>
          )}

          {(notesPreview || due) && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
              {due ? (
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-[var(--chip-pad-x)] py-[var(--chip-pad-y)] font-medium ${
                    task.completed ? "border-line bg-sunken text-faint" : TONE_CLASSES[due.tone]
                  }`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3" aria-hidden="true">
                    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
                    <path strokeLinecap="round" d="M3.5 9.5h17M8 3v4m8-4v4" />
                  </svg>
                  {due.text}
                </span>
              ) : null}

              {notesPreview ? (
                <span className="inline-flex min-w-0 items-center gap-1 text-[var(--faint)]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3 shrink-0" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h6M4.5 4.5h15v15l-3-2h-12v-13z" />
                  </svg>
                  <span className="truncate">{notesPreview}</span>
                </span>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {!inTrash ? (
            <span className="hidden text-[11px] font-medium tracking-tight text-faint tabular-nums sm:block">
              {new Intl.DateTimeFormat("en-US", {
                month: "short",
                day: "numeric",
                timeZone,
              }).format(task.createdAt)}
            </span>
          ) : null}

          <div className="flex items-center gap-0.5 opacity-100 transition-all focus-within:opacity-100 md:opacity-0 md:group-hover:opacity-100">
            {inTrash ? (
              <>
                <button
                  type="button"
                  onClick={onRestore}
                  aria-label="Restore task"
                  title="Restore"
                  className="rounded-lg p-1.5 text-success transition-all hover:bg-success-soft active:scale-95"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 1015.5-6.2M3 4v5h5" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={onPermanentDelete}
                  aria-label="Delete forever"
                  title="Delete forever"
                  className="rounded-lg p-1.5 text-danger transition-all hover:bg-danger-soft active:scale-95"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </>
            ) : (
              <>
                <Link
                  href={`/tasks/${task.id}`}
                  aria-label="View task details"
                  title="View details"
                  className="rounded-lg p-1.5 text-faint transition-all hover:bg-accent-soft hover:text-accent active:scale-95"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </Link>
                <button
                  type="button"
                  onClick={isEditing ? onCancelEdit : onStartEdit}
                  aria-label={isEditing ? "Close editor" : "Edit task"}
                  className="rounded-lg p-1.5 text-faint transition-all hover:bg-sunken hover:text-ink active:scale-95"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  aria-label="Move task to trash"
                  className="rounded-lg p-1.5 text-faint transition-all hover:bg-danger-soft hover:text-danger active:scale-95"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-3 border-t border-line-soft px-[var(--row-pad-x)] py-3">
          <div className="space-y-1">
            <label htmlFor={`task-title-${task.id}`} className="text-[11px] font-medium uppercase tracking-wide text-faint">
              Title
            </label>
            <input
              id={`task-title-${task.id}`}
              ref={inputRef}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (titleError) setTitleError(null);
              }}
              maxLength={120}
              aria-invalid={Boolean(titleError)}
              disabled={saving}
              className={`w-full rounded-xl border bg-surface px-3 py-2 text-sm text-ink transition placeholder:text-faint focus:outline-none ${
                titleError
                  ? "border-danger focus:border-danger"
                  : "border-line focus:border-line-strong"
              }`}
            />
            {titleError ? (
              <p role="alert" className="text-[11px] font-medium text-danger">
                {titleError}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor={`task-due-${task.id}`} className="text-[11px] font-medium uppercase tracking-wide text-faint">
                Due ({timeZone})
              </label>
              <input
                id={`task-due-${task.id}`}
                type="datetime-local"
                value={dueValue}
                onChange={(event) => setDueValue(event.target.value)}
                disabled={saving}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
              />
              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                {DAY_SHORTCUTS.map((shortcut) => (
                  <button
                    key={shortcut.label}
                    type="button"
                    onClick={() => applyShortcut(shortcut.days)}
                    disabled={saving}
                    className="rounded-lg border border-line px-2 py-0.5 text-[11px] font-medium text-muted transition hover:border-line-strong hover:text-ink active:scale-95"
                  >
                    {shortcut.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setDueValue("")}
                  disabled={saving || !dueValue}
                  className="rounded-lg px-2 py-0.5 text-[11px] font-medium text-faint transition hover:text-danger disabled:opacity-40"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor={`task-notes-${task.id}`} className="text-[11px] font-medium uppercase tracking-wide text-faint">
                Notes (Markdown)
              </label>
              <textarea
                id={`task-notes-${task.id}`}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={TASK_NOTES_MAX_LENGTH}
                rows={4}
                disabled={saving}
                placeholder={"- step one\n- **why** it matters\nhttps://example.com"}
                className="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 font-mono text-xs leading-relaxed text-ink placeholder:text-faint focus:border-line-strong focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-faint">
              {notes.length}/{TASK_NOTES_MAX_LENGTH} characters
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onCancelEdit}
                disabled={saving}
                className="rounded-xl px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-sunken hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-1.5 text-xs font-medium text-[var(--canvas)] transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}
