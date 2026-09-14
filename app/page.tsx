import TaskManager from "@/components/TaskManager";
import { requireCurrentUser } from "@/src/features/auth/require-user";
import {
  getPreferences,
  preferencesTimeZone,
} from "@/src/features/preferences/read";
import { countTrashForUser, listTasksForUser } from "@/src/features/tasks/service";
import { parseTaskListQuery } from "@/src/features/tasks/validation";
import { formatDatePart } from "@/src/lib/timezone";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    q?: string | string[];
    filter?: string | string[];
    trash?: string | string[];
  }>;
};

export default async function HomePage({ searchParams }: Props) {
  const user = await requireCurrentUser();
  const [preferences, params] = await Promise.all([getPreferences(), searchParams]);
  const timeZone = preferencesTimeZone(preferences);

  // One `now` for the whole render: the filter boundaries and every "Today"
  // label have to agree, and the client must not re-derive them.
  const now = new Date();
  const filters = parseTaskListQuery(params ?? {});

  const [allTasks, trashCount] = await Promise.all([
    listTasksForUser(user.id, filters, { timeZone, now }),
    countTrashForUser(user.id),
  ]);

  const todayLabel = formatDatePart(now, timeZone, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 py-10 sm:px-6">
      <section className="mb-8 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-accent">
          Your workspace
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
          Task manager
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-muted">
          {todayLabel} · keep your tasks private, organized, and available only to
          your signed-in account.
        </p>
      </section>

      <TaskManager
        initialTasks={allTasks}
        filters={filters}
        timeZone={timeZone}
        now={now}
        trashCount={trashCount}
      />
    </main>
  );
}
