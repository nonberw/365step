import { Link } from "react-router-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

// The call-to-action button hero-10 expects (the 21st.dev block does not ship it).
// Internal links go through the router, everything else is a plain anchor.

export interface CtaProps {
  ctaEnabled: boolean;
  text: string;
  link: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}

export function Cta({ cta }: Readonly<{ cta: CtaProps }>) {
  const { text, link, variant = "default", size = "lg" } = cta;
  return (
    <Button asChild variant={variant} size={size}>
      {link.startsWith("/") ? <Link to={link}>{text}</Link> : <a href={link || "#"}>{text}</a>}
    </Button>
  );
}
