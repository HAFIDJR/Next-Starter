import {
  PgTable,
  serial,
  text,
  boolean,
  timestamp,
  pgTable,
} from "drizzle-orm/pg-core";

export const tasks = pgTable("task", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
