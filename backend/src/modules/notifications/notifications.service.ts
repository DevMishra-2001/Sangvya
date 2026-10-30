// The bell: my notifications, newest first (cursor = last id seen), unread count, mark read.
import { and, count, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../config/db.js";
import { notifications, users } from "../../db/schema.js";
import { NotFoundError } from "../../utils/httpErrors.js";

const actor = alias(users, "actor");

export async function listNotifications(userId: number, { before, limit, unread }: { before?: number; limit: number; unread?: boolean }) {
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      link: notifications.link,
      entity_type: notifications.entity_type,
      entity_id: notifications.entity_id,
      actor_name: actor.name,
      read_at: notifications.read_at,
      created_at: notifications.created_at,
    })
    .from(notifications)
    .leftJoin(actor, eq(actor.id, notifications.actor_id))
    .where(and(eq(notifications.user_id, userId), before ? lt(notifications.id, before) : undefined, unread ? isNull(notifications.read_at) : undefined))
    .orderBy(desc(notifications.id))
    .limit(limit + 1);
  const more = rows.length > limit;
  const items = more ? rows.slice(0, limit) : rows;
  return { notifications: items, nextCursor: more ? items[items.length - 1].id : null, unread: await unreadCount(userId) };
}

export async function unreadCount(userId: number) {
  const [{ n }] = await db.select({ n: count() }).from(notifications).where(and(eq(notifications.user_id, userId), isNull(notifications.read_at)));
  return n;
}

export async function markRead(userId: number, id: number) {
  const [row] = await db
    .update(notifications)
    .set({ read_at: sql`coalesce(${notifications.read_at}, now())` })
    .where(and(eq(notifications.user_id, userId), eq(notifications.id, id)))
    .returning({ id: notifications.id });
  if (!row) throw new NotFoundError("Notification not found");
  return { unread: await unreadCount(userId) };
}

export async function markAllRead(userId: number) {
  await db.update(notifications).set({ read_at: sql`now()` }).where(and(eq(notifications.user_id, userId), isNull(notifications.read_at)));
  return { unread: 0 };
}

export async function deleteNotifications(userId: number, ids: number[]) {
  await db.delete(notifications).where(and(eq(notifications.user_id, userId), inArray(notifications.id, ids)));
  return { unread: await unreadCount(userId) };
}

// Housekeeping (jobs/notificationCleanup.job.ts): read ones after 60 days, all after 180
export async function cleanupNotifications() {
  const rows = await db
    .delete(notifications)
    .where(
      or(
        and(sql`${notifications.read_at} IS NOT NULL`, lt(notifications.created_at, sql`now() - interval '60 days'`)),
        lt(notifications.created_at, sql`now() - interval '180 days'`),
      ),
    )
    .returning({ id: notifications.id });
  return rows.length;
}
