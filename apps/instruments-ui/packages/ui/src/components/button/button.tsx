import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Button as BaseButton } from "@base-ui/react/button";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { children, className, variant = "primary", type = "button", ...other },
  ref,
) {
  return (
    <BaseButton
      {...other}
      className={["beats-button", className].filter(Boolean).join(" ")}
      data-variant={variant}
      ref={ref}
      type={type}
    >
      <span>{children}</span>
      <span aria-hidden="true" className="beats-button-signal" />
    </BaseButton>
  );
});

Button.displayName = "Button";
