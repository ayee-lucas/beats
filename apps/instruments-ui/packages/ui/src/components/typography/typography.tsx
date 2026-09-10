import "./typography.css";
import {
  createElement,
  type ComponentPropsWithoutRef,
  type ElementType,
} from "react";

export const typographyTags = {
  display: "h1",
  title: "h1",
  subtitle: "h2",
  heading: "h3",
  body: "p",
  "body-large": "p",
  "body-small": "p",
  label: "label",
  eyebrow: "p",
  caption: "small",
  "caption-tracked": "small",
  micro: "small",
  "micro-tracked": "small",
  "control-db-20": "span",
  "control-db-10": "span",
  "control-m-14": "span",
  "control-m-12": "span",
  "artwork-ub-120": "span",
  "artwork-ub-160": "span",
  "artwork-m-14": "span",
  "sign-in": "h2",
} as const;

export type TypographyVariant = keyof typeof typographyTags;

interface OwnProps<T extends ElementType> {
  variant?: TypographyVariant;
  as?: T;
  className?: string;
}

export type TypographyProps<T extends ElementType = "p"> = OwnProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof OwnProps<T>>;

export function Typography<T extends ElementType = "p">({
  variant = "body",
  as,
  className,
  ...props
}: TypographyProps<T>): JSX.Element {
  return createElement(as ?? typographyTags[variant], {
    ...props,
    className: [`beats-type-${variant}`, className].filter(Boolean).join(" "),
  });
}
