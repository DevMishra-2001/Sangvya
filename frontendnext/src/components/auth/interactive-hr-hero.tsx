"use client";

import { useEffect, useRef } from "react";
import {
  BarChart3,
  CalendarCheck,
  Laptop,
  Leaf,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import { loginDesktop } from "@/assets";

export function InteractiveHrHero() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = true;
      video.load();
      video.play().catch(() => {
        // Autoplay handled by browser
      });
    }
  }, []);

  return (
    <div className="relative w-full h-full min-h-screen overflow-hidden bg-slate-950 select-none p-8 xl:p-12 flex flex-col justify-between">
      {/* Background Video: Spans the entire section, autoplay, loop, muted */}
      <video
        key="workkind-login-vid-v2"
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster={
          typeof loginDesktop === "string" ? loginDesktop : loginDesktop.src
        }
        className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none z-0"
      >
        <source src="/login_vid.mp4?v=2" type="video/mp4" />
      </video>

      {/* Dark cinematic gradient overlays to make white text pop with maximum visibility */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-slate-950/55 via-slate-950/25 to-slate-950/15 pointer-events-none z-[1]"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-slate-950/45 via-slate-950/10 to-transparent pointer-events-none z-[1]"
        aria-hidden="true"
      />

      {/* Dotted SVG Connector Lines Overlay */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-10 hidden xl:block"
        fill="none"
        viewBox="0 0 1000 700"
        preserveAspectRatio="none"
      >
        {/* Curved dashed line from Leave Management card to center */}
        <path
          d="M 580 180 Q 550 250 510 270"
          stroke="#60A5FA"
          strokeWidth="2"
          strokeDasharray="5 5"
          opacity="0.85"
        />
        {/* Curved dashed line from Attendance card (adjusted lower) to center */}
        <path
          d="M 280 405 Q 380 415 430 420"
          stroke="#60A5FA"
          strokeWidth="2"
          strokeDasharray="5 5"
          opacity="0.85"
        />
        {/* Curved dashed line from Employee Directory card to center */}
        <path
          d="M 720 300 Q 640 320 590 350"
          stroke="#60A5FA"
          strokeWidth="2"
          strokeDasharray="5 5"
          opacity="0.85"
        />
      </svg>

      {/* Main Headline & Description (Upper-Left with High-Contrast White Text) */}
      <div className="relative z-20 max-w-md xl:max-w-lg mt-2 xl:mt-4">
        <h1 className="text-3xl xl:text-[44px] font-extrabold tracking-tight text-white leading-[1.12] drop-shadow-lg">
          A Smarter Way <br />
          to Manage Your{" "}
          <span className="text-[#93C5FD] bg-gradient-to-r from-[#BFDBFE] via-[#93C5FD] to-[#818CF8] bg-clip-text text-transparent relative inline-block drop-shadow-md">
            Workforce
            {/* 3 doodle sparkle rays */}
            <span className="absolute -top-3.5 -right-7 inline-flex items-center">
              <svg
                width="24"
                height="22"
                viewBox="0 0 24 22"
                fill="none"
                stroke="#60A5FA"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="drop-shadow"
              >
                <line x1="12" y1="2" x2="12" y2="8" />
                <line x1="4" y1="8" x2="8" y2="12" />
                <line x1="20" y1="8" x2="16" y2="12" />
              </svg>
            </span>
          </span>
        </h1>
        <p className="mt-3.5 text-sm xl:text-base text-slate-200 font-medium leading-relaxed max-w-sm xl:max-w-md drop-shadow-md">
          Manage attendance, leaves, employee data, team schedules and more —
          all in one place.
        </p>
      </div>

      {/* Floating Glass Badges */}
      {/* 1. Leave Management (Top-Middle/Right, above character) */}
      <div className="absolute top-[16%] xl:top-[18%] left-[52%] xl:left-[56%] z-20 bg-white/95 backdrop-blur-md rounded-2xl p-3 xl:p-3.5 shadow-2xl shadow-black/25 border border-white/90 flex items-center gap-3 transition-transform hover:-translate-y-1 duration-300">
        <div className="size-10 rounded-xl bg-[#E8F8EE] text-[#16A34A] flex items-center justify-center shrink-0">
          <Leaf className="size-5 fill-[#22C55E] text-[#16A34A]" />
        </div>
        <div>
          <div className="text-xs xl:text-sm font-bold text-slate-900 leading-tight">
            Leave Management
          </div>
          <p className="text-[10px] xl:text-[11px] text-slate-500 font-medium mt-0.5">
            Apply, track and approve leaves
          </p>
        </div>
      </div>

      {/* 2. Attendance (Middle-Left, positioned lower to clearly reveal pointing finger) */}
      <div className="absolute top-[54%] xl:top-[56%] left-[5%] xl:left-[7%] z-20 bg-white/95 backdrop-blur-md rounded-2xl p-3 xl:p-3.5 shadow-2xl shadow-black/25 border border-white/90 flex items-center gap-3 transition-transform hover:-translate-y-1 duration-300">
        <div className="size-10 rounded-xl bg-[#EEF4FF] text-[#2563EB] flex items-center justify-center shrink-0">
          <CalendarCheck className="size-5 text-[#2563EB]" />
        </div>
        <div>
          <div className="text-xs xl:text-sm font-bold text-slate-900 leading-tight">
            Attendance
          </div>
          <p className="text-[10px] xl:text-[11px] text-slate-500 font-medium mt-0.5">
            Daily punch in/out and live tracking
          </p>
        </div>
      </div>

      {/* 3. Employee Directory (Middle-Right) */}
      <div className="absolute top-[36%] xl:top-[38%] right-[4%] xl:right-[6%] z-20 bg-white/95 backdrop-blur-md rounded-2xl p-3 xl:p-3.5 shadow-2xl shadow-black/25 border border-white/90 flex items-center gap-3 transition-transform hover:-translate-y-1 duration-300">
        <div className="size-10 rounded-xl bg-[#EEF4FF] text-[#2563EB] flex items-center justify-center shrink-0">
          <Users className="size-5 text-[#2563EB]" />
        </div>
        <div>
          <div className="text-xs xl:text-sm font-bold text-slate-900 leading-tight">
            Employee Directory
          </div>
          <p className="text-[10px] xl:text-[11px] text-slate-500 font-medium mt-0.5">
            Connect and manage your team
          </p>
        </div>
      </div>

      {/* 4. Reports & Analytics (Lower-Right) */}
      <div className="absolute top-[55%] xl:top-[57%] right-[2%] xl:right-[4%] z-20 bg-white/95 backdrop-blur-md rounded-2xl p-3 xl:p-3.5 shadow-2xl shadow-black/25 border border-white/90 flex items-center gap-3 transition-transform hover:-translate-y-1 duration-300">
        <div className="size-10 rounded-xl bg-[#EEF4FF] text-[#2563EB] flex items-center justify-center shrink-0">
          <BarChart3 className="size-5 text-[#2563EB]" />
        </div>
        <div>
          <div className="text-xs xl:text-sm font-bold text-slate-900 leading-tight">
            Reports & Analytics
          </div>
          <p className="text-[10px] xl:text-[11px] text-slate-500 font-medium mt-0.5">
            Get insights and make better decisions
          </p>
        </div>
      </div>

      {/* Bottom Floating Pill Bar: Secure & Reliable | Easy to Use | Access Anywhere */}
      <div className="relative z-20 pt-6 mt-auto flex items-center justify-start">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-white/90 shadow-2xl shadow-black/25 px-6 py-3.5 flex items-center gap-6 text-xs text-slate-700 font-medium">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="size-5 text-[#2563EB]" />
            <div className="leading-tight">
              <span className="font-bold text-slate-900 block text-xs">
                Secure
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                & Reliable
              </span>
            </div>
          </div>
          <div className="h-6 w-px bg-slate-200" />
          <div className="flex items-center gap-2.5">
            <Zap className="size-5 text-[#2563EB] fill-[#2563EB]" />
            <div className="leading-tight">
              <span className="font-bold text-slate-900 block text-xs">
                Easy
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                to Use
              </span>
            </div>
          </div>
          <div className="h-6 w-px bg-slate-200" />
          <div className="flex items-center gap-2.5">
            <Laptop className="size-5 text-[#2563EB]" />
            <div className="leading-tight">
              <span className="font-bold text-slate-900 block text-xs">
                Access
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                Anywhere
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
