import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/AppShell";
import { Sky } from "@/pages/landing/Showcase";

/** Sign-in screen: the landing's sky with a white card in the middle (same look as the onboarding). */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col items-center px-3 py-6 sm:py-10">
      <Sky deep />
      <Link to="/" className="glass mb-6 rounded-full px-4 py-2" aria-label="365step — на главную">
        <Logo />
      </Link>
      <main className="w-full max-w-md rounded-[28px] bg-white p-6 text-[#1f2a2f] shadow-[0_30px_80px_-30px_rgba(24,61,154,0.55)] sm:p-8">{children}</main>
    </div>
  );
}
