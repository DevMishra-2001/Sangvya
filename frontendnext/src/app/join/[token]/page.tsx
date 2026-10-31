import type { Metadata } from "next";
import { JoinForm } from "@/components/join/join-form";

export const metadata: Metadata = { title: "Your joining details" };

// The token is only known per request
export const instant = false;

export default async function Page({ params }: PageProps<"/join/[token]">) {
  const { token } = await params;
  return <JoinForm token={token} />;
}
