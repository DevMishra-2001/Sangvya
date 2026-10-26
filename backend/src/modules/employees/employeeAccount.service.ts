// Saving an employee from the form, together with their login: a password
// creates the login (with the employee's email) or sets a new one, and
// loginBlocked blocks / unblocks it. The login change is checked first, so a
// refused change never leaves a half-saved employee.
import { assertLoginChangeAllowed, saveEmployeeLogin } from "../users/users.service.js";
import type { EmployeeInput } from "./employees.schema.js";
import { createEmployee, getEmployeeById, updateEmployee } from "./employees.service.js";

const loginChanges = (input: EmployeeInput) => ({ password: input.password, blocked: input.loginBlocked });

export async function createEmployeeWithLogin(companyId: number, actor: Express.AuthUser, input: EmployeeInput) {
  await assertLoginChangeAllowed(companyId, actor, null, input.email, loginChanges(input));
  const { employee } = await createEmployee(companyId, actor, input);
  await saveEmployeeLogin(companyId, actor, employee, loginChanges(input));
  return { employee: await getEmployeeById(companyId, employee.id) };
}

export async function updateEmployeeWithLogin(companyId: number, actor: Express.AuthUser, id: number, input: EmployeeInput) {
  await getEmployeeById(companyId, id);
  await assertLoginChangeAllowed(companyId, actor, id, input.email, loginChanges(input));
  const { employee } = await updateEmployee(companyId, actor, id, input);
  await saveEmployeeLogin(companyId, actor, employee, loginChanges(input));
  return { employee: await getEmployeeById(companyId, id) };
}
