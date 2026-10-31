import { AuthFrame } from "@/components/auth/auth-frame";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return <AuthFrame>{children}</AuthFrame>;
}
