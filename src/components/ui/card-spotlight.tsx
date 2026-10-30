"use client"

// Card Spotlight by Aceternity (21st.dev: manuarora700/card-spotlight).
// The original reveals a three.js dot-matrix shader; here a CSS dot grid does the same job
// so the landing page doesn't ship WebGL for a hover effect.

import { motion, useMotionTemplate, useMotionValue } from "motion/react"
import React, { type MouseEvent as ReactMouseEvent } from "react"
import { cn } from "@/lib/utils"

export const CardSpotlight = ({
  children,
  radius = 320,
  color = "rgba(123, 0, 4, 0.55)",
  className,
  ...props
}: {
  radius?: number
  color?: string
  children: React.ReactNode
} & React.HTMLAttributes<HTMLDivElement>) => {
  const mouseX = useMotionValue(-999)
  const mouseY = useMotionValue(-999)
  function handleMouseMove({ currentTarget, clientX, clientY }: ReactMouseEvent<HTMLDivElement>) {
    const { left, top } = currentTarget.getBoundingClientRect()
    mouseX.set(clientX - left)
    mouseY.set(clientY - top)
  }
  const mask = useMotionTemplate`radial-gradient(${radius}px circle at ${mouseX}px ${mouseY}px, white, transparent 80%)`

  return (
    <div className={cn("group/spotlight relative overflow-hidden rounded-3xl border border-white/10 bg-[#0d0b0b] p-8 text-white", className)} onMouseMove={handleMouseMove} {...props}>
      <motion.div
        className="pointer-events-none absolute -inset-px z-0 opacity-0 transition duration-300 group-hover/spotlight:opacity-100"
        style={{
          backgroundColor: color,
          backgroundImage: "radial-gradient(rgba(255,133,98,.55) 1.2px, transparent 1.3px)",
          backgroundSize: "14px 14px",
          maskImage: mask,
          WebkitMaskImage: mask,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

export default CardSpotlight
