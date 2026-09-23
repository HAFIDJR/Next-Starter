"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { jsonRequest } from "@/src/lib/api-client";
import { renderMarkdown } from "@/src/lib/markdown";
import type { TaskDto } from "@/src/features/tasks/types";
import {
  TASK_NOTES_MAX_LENGTH,
  taskNotesSchema,
} from "@/src/features/tasks/validation";

type Props = {
  task: TaskDto;
};

export default function TaskNotesEditor({ task }: Props) {
  const router = useRouter();

  const [value, setValue] = useState(task.notes ?? "");

  const [mode, setMode] = useState<"edit" | "preview">(
    task.notes ? "preview" : "edit",
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty = value.trim() !== (task.notes ?? "").trim();
  const editing = mode === "edit";

  async function save() {
    const result = taskNotesSchema.safeParse(value);

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Notes could not be saved.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await jsonRequest<TaskDto>(
        `/api/tasks/${task.id}`,
        "PATCH",
        { notes: result.data },
        "Could not save notes.",
      );
      setValue(result.data ?? "");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save notes.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line-soft bg-surface/70 p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Notes</h2>
        <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-0.5">
          {(["edit", "preview"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMode(option)}
              aria-pressed={mode === option}
              className={`rounded-[0.625rem] px-2.5 py-1 text-[11px] font-medium capitalize transition-all ${
                mode === option
                  ? "bg-sunken text-ink shadow-sm"
                  : "text-faint hover:text-muted"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {editing ? (
        <textarea
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(null);
          }}
          maxLength={TASK_NOTES_MAX_LENGTH}
          rows={10}
          aria-label="Task notes in Markdown"
          placeholder={
            "## Context\n- link: https://example.com\n- **deadline** details\n- [ ] open questions"
          }
          className="mt-3 w-full resize-y rounded-xl border border-line bg-surface px-3 py-2.5 font-mono text-xs leading-relaxed text-ink placeholder:text-faint focus:border-line-strong focus:outline-none"
        />
      ) : (
        <div className="mt-3 space-y-2 text-sm text-muted [&>*:first-child]:mt-0">
          {value.trim() ? (
            renderMarkdown(value)
          ) : (
            <p className="text-faint">Nothing to preview yet.</p>
          )}
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-2 text-[11px] font-medium text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-[11px] text-faint">
          {value.length}/{TASK_NOTES_MAX_LENGTH} · Markdown supported
        </span>
        <div className="flex items-center gap-1.5">
          {dirty ? (
            <button
              type="button"
              onClick={() => {
                setValue(task.notes ?? "");
                setError(null);
              }}
              disabled={saving}
              className="rounded-xl px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-sunken hover:text-ink"
            >
              Reset
            </button>
          ) : null}
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-1.5 text-xs font-medium text-[var(--canvas)] transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save notes"}
          </button>
        </div>
      </div>
    </div>
  );
}
