import { pgTable, uuid, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  // Identity
  id: uuid().defaultRandom().primaryKey(),

  // Credentials & security
  email: varchar({ length: 255 }).notNull().unique(),
  email_verified: boolean().notNull().default(false),
  password: varchar({ length: 255 }).notNull(),

  // Preferences
  timezone: varchar({ length: 50 }).notNull().default('UTC'),

  // Audit
  last_login_at: timestamp({ withTimezone: true }),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  deleted_at: timestamp({ withTimezone: true }),
});
