import type { Permission } from "../config/permissions.js";

// Does this user hold a permission? (worked out from their designation — see config/permissions.ts)
export const can = (user: Express.AuthUser, permission: Permission) => user.permissions.includes(permission);
