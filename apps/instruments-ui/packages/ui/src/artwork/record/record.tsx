import "./record.css";
import type { CSSProperties } from "react";
import { RecordSignalLabel } from "../record-signal-label/record-signal-label";

export interface RecordArtworkProps {
  /** Diameter in pixels; shrinks to fit its container. */
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** Accessible description. Omit when the artwork is decorative. */
  label?: string;
}

const grooveDiameters = [472, 440, 408, 376, 344, 312, 280];

/** Figma: Beats / Artwork / Record peeking behind split (136:17). */
export function RecordArtwork({
  size = 540,
  className,
  style,
  label,
}: RecordArtworkProps): JSX.Element {
  return (
    <div
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={["beats-record-artwork", className].filter(Boolean).join(" ")}
      role={label ? "img" : undefined}
      style={{ width: size, ...style }}
    >
      <div aria-hidden="true" className="beats-record-artwork-disc">
        <div className="beats-record-artwork-grooves">
          {grooveDiameters.map((diameter) => (
            <span
              className="beats-record-artwork-groove"
              key={diameter}
              style={{ width: `${(diameter / 540) * 100}%` }}
            />
          ))}
        </div>
        <RecordSignalLabel
          className="beats-record-artwork-label"
          style={{ width: `${(172 / 540) * 100}%` }}
        />
        <span className="beats-record-artwork-spindle" />
        <span className="beats-record-artwork-keyline" />
        <span className="beats-record-artwork-title">BEATS</span>
        <span className="beats-record-artwork-side">SIDE A / 001</span>
      </div>
    </div>
  );
}
