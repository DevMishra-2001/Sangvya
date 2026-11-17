// Fills the standard audit columns (db/auditColumns.ts) from the person doing it
type Actor = { id: number } | null | undefined;

export const stamp = {
  // New row: created and last changed by the same person
  created: (actor: Actor) => ({ created_by: actor?.id ?? null, updated_by: actor?.id ?? null }),
  updated: (actor: Actor) => ({ updated_by: actor?.id ?? null, updated_at: new Date() }),
};
