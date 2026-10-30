import type { Permission } from "../config/permissions.js";
import type { RoleKey } from "../db/schemas/role.schema.js";

declare global {
  namespace Express {
    interface AuthUser {
      id: number;
      // null until a new superadmin creates their first company
      companyId: number | null;
      email: string;
      // From their role in the current company (modules/pages/access.service.ts)
      isSuperadmin: boolean;
      roleKey: RoleKey | null;
      level: number;
      permissions: Permission[];
      employeeId: number | null;
      sessionId: number;
    }

    interface Request {
      // Set by `authenticate`
      user?: AuthUser;
      // Set by `scopeToCompany` — always taken from the signed token, never from the client
      companyId?: number;
    }
  }
}

export {};
