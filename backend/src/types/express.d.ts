import type { Role } from "../config/permissions.js";

declare global {
  namespace Express {
    interface AuthUser {
      id: number;
      // null until a new superadmin creates their first company
      companyId: number | null;
      role: Role;
      email: string;
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
