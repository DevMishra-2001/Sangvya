import { api } from "@/lib/api/client";
import type { AuthResponse } from "@/lib/types";
import type { LoginInput, SignupInput } from "@/lib/schemas/auth";

export const authService = {
  me: async () => (await api.get<AuthResponse>("/auth/me")).data,
  login: async (input: LoginInput) => (await api.post<AuthResponse>("/auth/login", input)).data,
  signup: async (input: SignupInput) => (await api.post<AuthResponse>("/auth/signup", input)).data,
  logout: async () => {
    await api.post("/auth/logout");
  },
  forgotPassword: async (email: string) =>
    (await api.post<{ message: string; resendAfterSec: number; otpValidMin: number }>("/auth/forgot-password", { email })).data,
  verifyOtp: async (email: string, otp: string) =>
    (await api.post<{ resetToken: string; expiresInMin: number }>("/auth/verify-otp", { email, otp })).data,
  resetPassword: async (resetToken: string, newPassword: string) => {
    await api.post("/auth/reset-password", { resetToken, newPassword });
  },
};
