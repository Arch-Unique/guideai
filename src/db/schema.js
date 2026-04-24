import { mysqlTable, varchar, timestamp, int, longtext } from 'drizzle-orm/mysql-core';

export const sessions = mysqlTable('sessions', {
  id:        varchar('id', { length: 36 }).primaryKey(),
  title:     varchar('title', { length: 255 }).notNull().default('New Chat'),
  model:     varchar('model', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const messages = mysqlTable('messages', {
  id:        int('id').autoincrement().primaryKey(),
  sessionId: varchar('session_id', { length: 36 }).notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  role:      varchar('role', { length: 20 }).notNull(),   // 'user' | 'assistant'
  content:   longtext('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});