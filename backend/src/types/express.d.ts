import type { Permission } from "../config/permissions.js";
import type { DesignationKey } from "../db/schemas/designation.schema.js";

declare global {
  namespace Express {
    interface AuthUser {
      id: number;
      // null until a new superadmin creates their first company
      companyId: number | null;
      email: string;
      // From their designation in the current company (modules/pages/access.service.ts)
      isSuperadmin: boolean;
      designationKey: DesignationKey | null;
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
