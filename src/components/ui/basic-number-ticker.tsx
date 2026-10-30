"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import {
  animate,
  type AnimationPlaybackControls,
  motion,
  useMotionValue,
  useTransform,
  type ValueAnimationTransition,
} from "motion/react";

import { cn } from "@/lib/utils";

interface NumberTickerProps {
  from: number; // Starting value of the animation
  target: number; // End value of the animation
  transition?: ValueAnimationTransition; // Animation configuration, refer to motion docs for more details
  className?: string; // additionl CSS classes for styling
  onStart?: () => void; // Callback function when animation starts
  onComplete?: () => void; // Callback function when animation completes
  autoStart?: boolean; // Whether to start the animation automatically
}

// Ref interface to allow external control of the animation
export interface NumberTickerRef {
  startAnimation: () => void;
}

const NumberTicker = forwardRef<NumberTickerRef, NumberTickerProps>(
  (
    {
      from = 0,
      target = 100,
      transition = {
        duration: 3,
        type: "tween",
        ease: "easeInOut",
      },
      className,
      onStart,
      onComplete,
      autoStart = true,
      ...props
    },
    ref,
  ) => {
    const count = useMotionValue(from);
    const rounded = useTransform(count, (latest) => Math.round(latest));
    const [controls, setControls] = useState<AnimationPlaybackControls | null>(
      null,
    );

    // Function to start the animation
    const startAnimation = useCallback(() => {
      if (controls) controls.stop();
      onStart?.();

      count.set(from);

      const newControls = animate(count, target, {
        ...transition,
        onComplete: () => {
          onComplete?.();
        },
      });
      setControls(newControls);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [target]);

    // Expose the startAnimation function via ref
    useImperativeHandle(ref, () => ({
      startAnimation,
    }));

    useEffect(() => {
      if (autoStart) {
        startAnimation();
      }
      return () => controls?.stop();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoStart, target]);

    return (
      <motion.span className={cn(className)} {...props}>
        {rounded}
      </motion.span>
    );
  },
);

NumberTicker.displayName = "NumberTicker";

export default NumberTicker;
