import { z } from "zod";
import { strongPassword } from "../../utils/passwordPolicy.js";

const token = z.string({ required_error: "Activation link is missing its token" }).trim().min(1, "Activation link is missing its token");

export const verifyInviteSchema = z.object({ token });
export const acceptInviteSchema = z.object({ token, password: strongPassword });
