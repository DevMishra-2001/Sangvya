import { index, integer, pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createdAt, fk, id, timestamptz } from "../columns.js";
import { users } from "./user.schema.js";

// Activation links. Nobody ever sets someone else's password: the invited
// person opens the emailed link and sets their own. Only a hash of the token
// is stored; a new invite (resend) revokes the earlier one.
export const userInvitations = pgTable(
  "user_invitations",
  {
    id: id(),
    user_id: integer("user_id").notNull(),
    // "admin" = a company owner invited by the Super Admin (the only kind for now)
    purpose: varchar("purpose", { length: 20 }).notNull().default("admin"),
    // Pre-fills the company setup form after activation
    company_name: varchar("company_name", { length: 200 }),
    token_hash: text("token_hash").notNull().unique("user_invitations_token_hash_key"),
    expires_at: timestamptz("expires_at").notNull(),
    accepted_at: timestamptz("accepted_at"),
    revoked_at: timestamptz("revoked_at"),
    invited_by: integer("invited_by"),
    created_at: createdAt(),
  },
  (t) => [
    fk("user_invitations", t.user_id, users.id, "cascade"),
    fk("user_invitations", t.invited_by, users.id, "set null"),
    index("idx_user_invitations_user").on(t.user_id),
  ],
);
