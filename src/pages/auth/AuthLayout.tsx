import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/AppShell";

/** Split screen: painting on the left, form on the right (stacked on phones). */
export default function AuthLayout({ image, quote, children }: { image: string; quote: { text: string; by: string }; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden lg:block">
        <img src={image} alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 p-10 text-white">
          <p className="max-w-md font-display text-2xl font-medium leading-snug">«{quote.text}»</p>
          <p className="mt-3 text-sm text-white/70">{quote.by}</p>
        </div>
        <Link to="/" className="absolute left-8 top-8 rounded-full bg-black/35 px-4 py-2 text-white backdrop-blur">
          <Logo className="text-white [&>span]:text-accent" />
        </Link>
      </aside>
      <main className="flex min-w-0 flex-col px-4 py-6 sm:px-8 lg:px-14">
        <Link to="/" className="mb-8 lg:hidden">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col justify-center py-6">{children}</div>
      </main>
    </div>
  );
}
