import Image from "next/image";
import { loginMobile } from "@/assets";
import { InteractiveHrHero } from "@/components/auth/interactive-hr-hero";
import { ForceLight } from "@/components/layout/force-light";

// Auth pages' frame: hero on the left (desktop) / on top (mobile), the form on the right
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen w-full flex flex-col lg:flex-row bg-white selection:bg-[#2563EB]/20">
      {/* Always light, whatever theme the user picked (dropdowns/tooltips too) */}
      <ForceLight />
      {/* Left Column (Desktop ~60-65%): Full Background Image */}
      <div className="hidden lg:block lg:flex-[1.25] xl:flex-[1.35] min-w-0 relative">
        <InteractiveHrHero />
      </div>

      {/* Right Column (Form Container): Clean White with subtle top & bottom gradients */}
      <section className="flex-1 min-w-[320px] w-full min-h-screen flex flex-col items-center bg-white relative overflow-hidden lg:max-w-[560px] lg:mx-auto lg:justify-center lg:p-12 xl:p-16">
        {/* Top-Right Soft Ambient Curve & Gradient Glow */}
        <div
          className="hidden lg:block absolute -top-24 -right-24 w-80 h-80 rounded-full bg-gradient-to-br from-blue-100/60 via-indigo-50/40 to-transparent blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="hidden lg:block absolute top-0 right-0 w-52 h-52 bg-gradient-to-bl from-[#EEF4FF] via-[#F4F8FF]/50 to-transparent rounded-bl-[120px] pointer-events-none opacity-80"
          aria-hidden="true"
        />

        {/* Bottom-Left Soft Organic Curve Accent */}
        <div
          className="hidden lg:block absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-gradient-to-tr from-[#E0EDFD]/70 via-[#EFF6FF]/40 to-transparent blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="hidden lg:block absolute bottom-0 left-0 w-44 h-44 bg-gradient-to-tr from-[#E2EFFD]/70 to-transparent rounded-tr-[100px] pointer-events-none opacity-70"
          aria-hidden="true"
        />

        {/* Mobile / tablet: full-bleed image from the very top; the form sheet slides over it */}
        <div className="lg:hidden relative w-full h-[46vh] min-h-64 max-h-[480px] shrink-0">
          <Image src={loginMobile} alt="Workkind Workforce Management" fill priority sizes="100vw" className="object-cover object-top sm:object-[center_38%]" />
        </div>

        {/* Form: a rounded sheet over the image on mobile, plain on desktop */}
        <div className="relative z-10 -mt-8 w-full flex-1 rounded-t-[28px] bg-white px-6 pt-8 pb-10 shadow-[0_-10px_30px_rgba(15,23,42,0.12)] sm:px-10 lg:mt-0 lg:flex-none lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none">
          <div className="mx-auto w-full max-w-[400px]">{children}</div>
        </div>
      </section>
    </main>
  );
}
