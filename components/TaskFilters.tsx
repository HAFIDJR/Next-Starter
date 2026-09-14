"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { TASK_SEARCH_DEBOUNCE_MS } from "@/src/features/tasks/constants";
import {
  TASK_FILTER_LABELS,
  TASK_FILTERS,
  type TaskFilter,
  type TaskListFilters,
} from "@/src/features/tasks/types";
import {
  buildTaskListQuery,
  TASK_SEARCH_MAX_LENGTH,
} from "@/src/features/tasks/validation";

type Props = {
  /** The URL is the source of truth; this component only ever rewrites it. */
  filters: TaskListFilters;
  trashCount: number;
};

export default function TaskFilters({ filters, trashCount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  /** `null` means "show the URL". Only keystrokes need local state. */
  const [typed, setTyped] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const query = typed ?? filters.q;
  const dirty = query.trim() !== filters.q;

  const navigate = useCallback(
    (next: TaskListFilters) => {
      // replace (not push): filtering should not flood the back stack.
      router.replace(`${pathname}${buildTaskListQuery(next)}`, { scroll: false });
    },
    [pathname, router],
  );

  // Debounce keystrokes into the URL. `dirty` becomes false when the server's
  // render comes back with the new filters, which is also the pending signal.
  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed === filters.q) {
      return;
    }

    const timer = setTimeout(() => {
      setTyped(null);
      navigate({ ...filters, q: trimmed });
    }, TASK_SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, filters, navigate]);

  // `/` focuses search, Escape clears it — cheap muscle memory for a task app.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable === true;

      if (event.key === "/" && !typing) {
        event.preventDefault();
        inputRef.current?.focus();
        return;
      }

      if (event.key === "Escape" && document.activeElement === inputRef.current) {
        setTyped(null);
        navigate({ ...filters, q: "" });
        inputRef.current?.blur();
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filters, navigate]);

  function selectFilter(filter: TaskFilter) {
    navigate({ ...filters, filter, trash: false });
  }

  function toggleTrash() {
    navigate({ ...filters, trash: !filters.trash, filter: "all" });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div
          className={`group relative flex flex-1 items-center gap-2 rounded-xl border bg-surface px-3 transition-all ${
            query ? "border-line-strong" : "border-line"
          } focus-within:border-accent`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
          </svg>
          <label htmlFor="task-search" className="sr-only">
            Search tasks
          </label>
          <input
            id="task-search"
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setTyped(event.target.value)}
            onBlur={() => setTyped(null)}
            maxLength={TASK_SEARCH_MAX_LENGTH}
            autoComplete="off"
            placeholder="Search titles and notes…  ( / to focus, Esc to clear )"
            className="w-full bg-transparent py-2 text-sm text-ink placeholder:text-faint focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setTyped(null);
                navigate({ ...filters, q: "" });
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="rounded-md p-0.5 text-faint transition hover:bg-sunken hover:text-ink"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={toggleTrash}
          aria-pressed={filters.trash}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-all active:scale-[0.98] ${
            filters.trash
              ? "border-danger/40 bg-danger-soft text-danger"
              : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Trash
          {trashCount > 0 ? (
            <span className="rounded-full bg-sunken px-1.5 text-[10px] tabular-nums">
              {trashCount}
            </span>
          ) : null}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter tasks">
        {TASK_FILTERS.map((filter) => {
          const active = !filters.trash && filters.filter === filter;

          return (
            <button
              key={filter}
              type="button"
              onClick={() => selectFilter(filter)}
              aria-pressed={active}
              className={`rounded-full border px-[var(--chip-pad-x)] py-[var(--chip-pad-y)] text-[11px] font-medium transition-all active:scale-95 ${
                active
                  ? "border-transparent bg-ink text-[var(--canvas)] shadow-sm"
                  : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink"
              }`}
            >
              {TASK_FILTER_LABELS[filter]}
            </button>
          );
        })}

        {filters.q || dirty ? (
          <span
            aria-live="polite"
            className={`ml-auto text-[11px] font-medium transition-opacity ${
              dirty ? "text-accent opacity-100" : "text-faint opacity-70"
            }`}
          >
            {dirty
              ? "Updating…"
              : `${filters.q ? `Matching “${filters.q}”` : ""}${
                  filters.filter !== "all"
                    ? `${filters.q ? " · " : ""}${TASK_FILTER_LABELS[filters.filter]}`
                    : ""
                }`}
          </span>
        ) : null}
      </div>
    </div>
  );
}
