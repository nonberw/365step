"use client"

// Sticky Scroll Reveal by Aceternity (21st.dev: manuarora700/sticky-scroll-reveal),
// adapted to page scroll with a sticky preview panel that cross-fades between items.

import React, { useRef, useState } from "react"
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react"
import { cn } from "@/lib/utils"

export interface StickyItem {
  title: string
  description: string
  eyebrow?: string
  content: React.ReactNode
}

export function StickyScroll({ content, className }: { content: StickyItem[]; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start center", "end center"] })

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const i = Math.min(content.length - 1, Math.max(0, Math.floor(latest * content.length)))
    setActive(i)
  })

  return (
    <div ref={ref} className={cn("relative grid gap-10 lg:grid-cols-2", className)}>
      <div>
        {content.map((item, index) => (
          <div key={item.title} className="flex min-h-[70vh] flex-col justify-center py-10">
            <motion.div animate={{ opacity: active === index ? 1 : 0.25, x: active === index ? 0 : -8 }} transition={{ duration: 0.4 }}>
              {item.eyebrow && <p className="eyebrow">{item.eyebrow}</p>}
              <h3 className="mt-2 font-display text-3xl font-semibold leading-tight sm:text-4xl">{item.title}</h3>
              <p className="mt-4 max-w-md text-[17px] text-muted-foreground">{item.description}</p>
            </motion.div>
            {/* On phones the preview sits under each step instead of sticking. */}
            <div className="mt-6 lg:hidden">{item.content}</div>
          </div>
        ))}
      </div>
      <div className="hidden lg:block">
        <div className="sticky top-[15vh] h-[70vh]">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 30, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -30, scale: 0.97 }}
              transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
              className="h-full"
            >
              {content[active]?.content}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

export default StickyScroll
