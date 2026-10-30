"use client"

// Scroll word reveal — from the official Motion examples (21st.dev: motiondotdev/motion-scroll-word-reveal),
// adapted to page scroll, Tailwind classes and props.

import { Fragment, useRef } from "react"
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react"
import { cn } from "@/lib/utils"

const REST_OPACITY = 0.15
const REVEAL_SPAN = 0.8
const WORD_WINDOW = 0.2

function getWordRange(index: number, count: number) {
  const start = count <= 1 ? 0 : (index / (count - 1)) * REVEAL_SPAN
  return { start, end: Math.min(1, start + WORD_WINDOW) }
}

export function getWordOpacity(progress: number, { start, end }: { start: number; end: number }, rest = REST_OPACITY) {
  if (progress <= start) return rest
  if (progress >= end) return 1
  const t = (progress - start) / (end - start)
  return rest + (1 - rest) * t
}

function Word({ children, progress, index, count, reducedMotion, accent }: { children: string; progress: MotionValue<number>; index: number; count: number; reducedMotion: boolean; accent: boolean }) {
  const range = getWordRange(index, count)
  const opacity = useTransform(progress, (value) => getWordOpacity(value, range))
  return (
    <motion.span aria-hidden="true" className={accent ? "text-primary" : undefined} style={reducedMotion ? undefined : { opacity }}>
      {children}
    </motion.span>
  )
}

/** Words light up one by one as the section scrolls through the viewport. Wrap a word in *asterisks* to colour it. */
export function ScrollWordReveal({ text, kicker, className }: { text: string; kicker?: string; className?: string }) {
  const targetRef = useRef<HTMLElement>(null)
  const reducedMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: targetRef, offset: ["start start", "end end"] })
  const words = text.split(" ")

  return (
    <section ref={targetRef} className={cn("relative h-[220vh]", className)} aria-label={text.replace(/\*/g, "")}>
      <div className="sticky top-0 flex h-dvh items-center">
        <div className="mx-auto flex w-full max-w-5xl gap-6 px-4 sm:gap-10 sm:px-6">
          <div className="relative w-1 shrink-0 overflow-hidden rounded-full bg-border" aria-hidden="true">
            <motion.span className="absolute inset-x-0 top-0 h-full origin-top rounded-full bg-primary" style={{ scaleY: reducedMotion ? 1 : scrollYProgress }} />
          </div>
          <div>
            {kicker && <p className="eyebrow mb-4">{kicker}</p>}
            <p className="font-display text-[clamp(28px,5vw,60px)] font-semibold leading-[1.08] tracking-tight">
              {words.map((word, index) => (
                <Fragment key={`${word}-${index}`}>
                  <Word progress={scrollYProgress} index={index} count={words.length} reducedMotion={!!reducedMotion} accent={word.startsWith("*")}>
                    {word.replace(/\*/g, "")}
                  </Word>
                  {index < words.length - 1 ? " " : null}
                </Fragment>
              ))}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ScrollWordReveal
