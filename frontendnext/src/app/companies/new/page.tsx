import type { Metadata } from "next";
import { NewCompanyView } from "@/components/companies/new-company-view";

export const metadata: Metadata = { title: "Add a company" };

// Full-width light page outside the app shell (proxy.ts still checks the user may open it)
export default function Page() {
  return <NewCompanyView />;
}
