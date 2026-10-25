import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { ACCENT_STORAGE_KEY, DEFAULT_ACCENT } from "@/lib/appearance";
import "./globals.css";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Sangvya", template: "%s · Sangvya" },
  description: "Sangvya — HR management for growing teams",
};

// Applies the saved accent color before the first paint, so the page never
// flashes the default color. (Light/dark is handled the same way by next-themes.)
const accentScript = `try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(ACCENT_STORAGE_KEY)})||"{}");var a=(s.state&&s.state.accent)||${JSON.stringify(DEFAULT_ACCENT)};if(a!=="neutral")document.documentElement.dataset.accent=a;}catch(e){document.documentElement.dataset.accent=${JSON.stringify(DEFAULT_ACCENT)};}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: accentScript }} />
      </head>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
