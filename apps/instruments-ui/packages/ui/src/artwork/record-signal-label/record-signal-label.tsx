import "./record-signal-label.css";
import type { CSSProperties } from "react";

export interface RecordSignalLabelProps {
  /** Diameter in pixels. The Figma artwork is 172px. */
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** Omit for decorative artwork; supply only when the artwork conveys meaning. */
  label?: string;
}

/** Decorative brand artwork, not a recording control or status indicator. */
export function RecordSignalLabel({
  size = 172,
  className,
  style,
  label,
}: RecordSignalLabelProps): JSX.Element {
  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={["beats-record-signal-label", className].filter(Boolean).join(" ")}
      role={label ? "img" : undefined}
      style={{ width: size, ...style }}
    />
  );
}
