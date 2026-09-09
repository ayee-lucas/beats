import { Button as BaseButton } from '@base-ui/react/button';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function Button({ children, ...other }: ButtonProps): JSX.Element {
  return (
    <BaseButton type="button"  {...other}>
      {children}
    </BaseButton>
  );
}

Button.displayName = "Button";
