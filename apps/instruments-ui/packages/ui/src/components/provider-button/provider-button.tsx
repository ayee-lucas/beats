import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Button as BaseButton } from "@base-ui/react/button";

export type SignInProvider = "apple" | "google";

export interface ProviderButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  provider: SignInProvider;
  /** Override the default sign-in text, for example for localization. */
  label?: string;
  /** Supply a permanent provider logo asset instead of the Figma fallback. */
  iconSrc?: string;
}

// Temporary Figma export; consumers can supply a permanent asset via iconSrc.
const googleIcon =
  "https://www.figma.com/api/mcp/asset/5ca31d39-53cb-433a-91c9-72e0c8fd191e.svg";

const labels: Record<SignInProvider, string> = {
  apple: "Sign in With Apple",
  google: "Sign in with Google",
};

export const ProviderButton = forwardRef<HTMLButtonElement, ProviderButtonProps>(
  function ProviderButton(
    { provider, label, iconSrc, className, type = "button", ...other },
    ref,
  ) {
    const logo = iconSrc ?? (provider === "google" ? googleIcon : undefined);

    return (
      <BaseButton
        {...other}
        className={["beats-provider-button", className].filter(Boolean).join(" ")}
        data-provider={provider}
        ref={ref}
        type={type}
      >
        {logo ? (
          <img alt="" className="beats-provider-button-icon" src={logo} />
        ) : (
          <span aria-hidden="true" className="beats-provider-button-apple-mark">
            {"\uF8FF"}
          </span>
        )}
        <span>{label ?? labels[provider]}</span>
      </BaseButton>
    );
  },
);

ProviderButton.displayName = "ProviderButton";
