import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Volumetric "pressable" buttons: a solid edge under the face that collapses on press.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl font-display font-extrabold tracking-wide transition-[background,transform,box-shadow,filter] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_4px_0_0_var(--primary-edge)] hover:brightness-105 active:translate-y-1 active:shadow-none",
        dark: "bg-secondary text-secondary-foreground shadow-[0_4px_0_0_color-mix(in_srgb,var(--secondary)_55%,black)] hover:brightness-110 active:translate-y-1 active:shadow-none",
        outline: "border-2 border-border bg-card shadow-[0_3px_0_0_var(--border)] hover:bg-muted active:translate-y-[3px] active:shadow-none",
        ghost: "hover:bg-muted",
        accent: "bg-accent text-accent-foreground shadow-[0_4px_0_0_#c79a00] hover:brightness-105 active:translate-y-1 active:shadow-none",
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
