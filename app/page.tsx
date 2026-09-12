import TaskManager from "@/components/TaskManager";
import { requireCurrentUser } from "@/src/features/auth/require-user";
import { listTasksForUser } from "@/src/features/tasks/service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireCurrentUser();
  const allTasks = await listTasksForUser(user.id);
  const taskListKey = allTasks
    .map(
      (task) => `${task.id}:${task.title}:${task.completed}:${task.createdAt}`,
    )
    .join("|");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 py-10 sm:px-6">
      <section className="mb-8 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-indigo-500">
          Your workspace
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
          Task manager
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-slate-600">
          Keep your tasks private, organized, and available only to your
          signed-in account.
        </p>
      </section>

      <TaskManager key={taskListKey} initialTasks={allTasks} />
    </main>
  );
}
