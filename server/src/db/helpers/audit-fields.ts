import { timestamp } from 'drizzle-orm/pg-core';

const auditFields = {
  // When the row was first persisted. Portfolio APIs return this for entries.
  createdAt: timestamp('created_at').defaultNow().notNull(),
  // Tracks the latest mutation time and is used for stable ordering of recent updates.
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
};

export default auditFields;
