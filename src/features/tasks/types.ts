export type TaskDto = {
  id: number;
  title: string;
  notes: string | null;
  dueAt: Date | null;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export const TASK_FILTERS = [
  "all",
  "active",
  "completed",
  "today",
  "overdue",
] as const;

export type TaskFilter = (typeof TASK_FILTERS)[number];

export type TaskListFilters = {
  q: string;
  filter: TaskFilter;
  trash: boolean;
};

export const DEFAULT_TASK_LIST_FILTERS: TaskListFilters = {
  q: "",
  filter: "all",
  trash: false,
};

export const TASK_FILTER_LABELS: Record<TaskFilter, string> = {
  all: "All",
  active: "Active",
  completed: "Done",
  today: "Today",
  overdue: "Overdue",
};
