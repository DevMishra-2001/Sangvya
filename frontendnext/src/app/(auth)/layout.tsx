import Image from "next/image";
import { Users } from "lucide-react";
import { loginMobile } from "@/assets";
import { InteractiveHrHero } from "@/components/auth/interactive-hr-hero";
import { ForceLight } from "@/components/layout/force-light";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="min-h-screen w-full flex flex-col lg:flex-row bg-white selection:bg-[#2563EB]/20">
      {/* Always light, whatever theme the user picked (dropdowns/tooltips too) */}
      <ForceLight />
      {/* Left Column (Desktop ~60-65%): Full Background Image */}
      <div className="hidden lg:block lg:flex-[1.25] xl:flex-[1.35] min-w-0 relative">
        <InteractiveHrHero />
      </div>

      {/* Right Column (Form Container): Clean White with subtle top & bottom gradients */}
      <section className="flex-1 min-w-[320px] max-w-[560px] mx-auto w-full min-h-screen flex flex-col justify-center items-center p-6 sm:p-10 lg:p-12 xl:p-16 bg-white relative overflow-hidden">
        {/* Top-Right Soft Ambient Curve & Gradient Glow */}
        <div
          className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-gradient-to-br from-blue-100/60 via-indigo-50/40 to-transparent blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute top-0 right-0 w-52 h-52 bg-gradient-to-bl from-[#EEF4FF] via-[#F4F8FF]/50 to-transparent rounded-bl-[120px] pointer-events-none opacity-80"
          aria-hidden="true"
        />

        {/* Bottom-Left Soft Organic Curve Accent */}
        <div
          className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-gradient-to-tr from-[#E0EDFD]/70 via-[#EFF6FF]/40 to-transparent blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute bottom-0 left-0 w-44 h-44 bg-gradient-to-tr from-[#E2EFFD]/70 to-transparent rounded-tr-[100px] pointer-events-none opacity-70"
          aria-hidden="true"
        />

        {/* Mobile Showcase Header (visible only on mobile/tablet when left hero is hidden) */}
        <div className="lg:hidden w-full max-w-[400px] mb-6 flex flex-col items-center text-center relative z-10">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="size-9 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Users className="size-5 text-white" />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-[#1E293B]">Workkind</span>
          </div>
          <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden mb-4 border border-slate-200/80 shadow-md">
            <Image
              src={loginMobile}
              alt="Workkind Workforce Management"
              fill
              priority
              className="object-cover object-top"
            />
          </div>
        </div>

        {/* Form Content */}
        <div className="w-full max-w-[400px] relative z-10">
          {children}
        </div>
      </section>
    </main>
  );
}
