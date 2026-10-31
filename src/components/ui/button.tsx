import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Glossy pressable buttons (folk): a lit gradient face over a darker edge that collapses on press.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[13px] font-display font-bold transition-[background,transform,box-shadow,filter] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[linear-gradient(#4a74dc,#1f48b0)] text-white shadow-[0_3px_0_0_#163a8f,0_8px_16px_-6px_rgba(24,61,154,0.5)] [text-shadow:0_1px_0_rgba(0,0,0,0.2)] hover:brightness-110 active:translate-y-[3px] active:shadow-[0_2px_6px_-2px_rgba(24,61,154,0.5)]",
        dark: "bg-secondary text-secondary-foreground shadow-[0_4px_0_0_color-mix(in_srgb,var(--secondary)_55%,black)] hover:brightness-110 active:translate-y-1 active:shadow-none",
        outline: "border border-border bg-card/80 shadow-[0_2px_0_0_var(--border)] backdrop-blur hover:bg-card active:translate-y-[2px] active:shadow-none",
        ghost: "hover:bg-muted",
        accent: "bg-[linear-gradient(#ff7a6e,#e8453a)] text-white shadow-[0_3px_0_0_#b92f26] hover:brightness-105 active:translate-y-[3px] active:shadow-none",
        link: "text-primary underline-offset-4 hover:underline rounded-none",
      },
      size: {
        default: "h-11 px-5 text-sm",
        sm: "h-9 px-4 text-xs",
        lg: "h-14 px-8 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = "Button";

export { buttonVariants };
