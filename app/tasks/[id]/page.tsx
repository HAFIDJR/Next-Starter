import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTaskById } from "@/app/api/tasks/route";
import TaskDetailActions from "./TaskDetailActions";

type Props = {
  params: Promise<{ id: string }>;
};

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const taskId = parseId(id);
  const task = taskId ? await getTaskById(taskId) : null;

  return { title: task ? `Task: ${task.title}` : "Task not found" };
}

export default async function TaskDetailPage({ params }: Props) {
  const { id } = await params;
  const taskId = parseId(id);

  if (!taskId) notFound();

  const task = await getTaskById(taskId);

  if (!task) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 p-6">
      {/* Server-rendered detail */}
      <div className="rounded-2xl border border-slate-100 bg-white/70 p-6 shadow-sm backdrop-blur-sm">
        <div className="flex items-start justify-between gap-4">
          <h1
            className={`text-xl font-semibold ${
              task.completed ? "text-slate-400 line-through" : "text-slate-900"
            }`}
          >
            {task.title}
          </h1>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
              task.completed
                ? "bg-emerald-50 text-emerald-600"
                : "bg-amber-50 text-amber-600"
            }`}
          >
            {task.completed ? "Done" : "Pending"}
          </span>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 text-xs">
          <div>
            <dt className="text-slate-400">ID</dt>
            <dd className="font-medium text-slate-700">#{task.id}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Created</dt>
            <dd className="font-medium text-slate-700">
              {new Date(task.createdAt).toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>
      {/* Client Component interleaved into the Server Component tree */}
      <TaskDetailActions task={task} />
    </main>
  );
}
