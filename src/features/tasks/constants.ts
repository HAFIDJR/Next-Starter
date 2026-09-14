/** Soft-deleted tasks are kept this long so "undo" works after a page reload. */
export const TRASH_RETENTION_DAYS = 30;

/** Debounce for the search box before it pushes a value into the URL. */
export const TASK_SEARCH_DEBOUNCE_MS = 300;

/** How long an undo toast stays on screen before it is treated as "dismissed". */
export const UNDO_TOAST_DURATION_MS = 8000;
