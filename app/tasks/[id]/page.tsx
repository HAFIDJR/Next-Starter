import { notFound } from "next/navigation";

import TaskDetailActions from "./TaskDetailActions";
import TaskNotesEditor from "@/components/TaskNotesEditor";
import { getCurrentUser } from "@/src/features/auth/session";
import { requireCurrentUser } from "@/src/features/auth/require-user";
import {
  getPreferences,
  preferencesTimeZone,
} from "@/src/features/preferences/read";
import { describeDue } from "@/src/features/tasks/due-date";
import { getTaskForUser } from "@/src/features/tasks/service";
import { parseTaskId } from "@/src/features/tasks/validation";
import { formatDatePart } from "@/src/lib/timezone";
import { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const taskId = parseTaskId(id);
  const user = await getCurrentUser();
  const task = taskId && user ? await getTaskForUser(taskId, user.id) : null;

  return {
    title: task ? `Task: ${task.title}` : "Task not found",
    description: task?.title,
  };
}

export default async function TaskDetailPage({ params }: Props) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const taskId = parseTaskId(id);

  if (!taskId) {
    notFound();
  }

  const preferences = await getPreferences();
  const timeZone = preferencesTimeZone(preferences);
  const now = new Date();
  const task = await getTaskForUser(taskId, user.id);

  if (!task) {
    notFound();
  }

  const due = describeDue(task.dueAt, {
    now,
    timeZone,
    completed: task.completed,
  });

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 p-6">
      <div className="rounded-2xl border border-line-soft bg-surface/70 p-6 shadow-sm backdrop-blur-sm">
        <div className="flex items-start justify-between gap-4">
          <h1
            className={`text-xl font-semibold ${
              task.completed ? "text-faint line-through" : "text-ink"
            }`}
          >
            {task.title}
          </h1>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
              task.completed
                ? "bg-success-soft text-success"
                : "bg-warning-soft text-warning"
            }`}
          >
            {task.completed ? "Done" : "Pending"}
          </span>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-faint">ID</dt>
            <dd className="font-medium text-muted">#{task.id}</dd>
          </div>
          <div>
            <dt className="text-faint">Created</dt>
            <dd className="font-medium text-muted">
              {formatDatePart(task.createdAt, timeZone, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </dd>
          </div>
          <div>
            <dt className="text-faint">Due</dt>
            <dd
              className={`font-medium ${
                due?.tone === "overdue"
                  ? "text-danger"
                  : due?.tone === "today"
                    ? "text-warning"
                    : "text-muted"
              }`}
            >
              {due ? due.text : "No due date"}
            </dd>
          </div>
        </dl>
      </div>
      <TaskNotesEditor task={task} />
      <TaskDetailActions task={task} />
    </main>
  );
}
