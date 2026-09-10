import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/button.tsx", "src/provider-button.tsx", "src/typography.tsx", "src/record-signal-label.tsx", "src/record.tsx"],
  format: ["cjs", "esm"],
  dts: true,
  deps: { neverBundle: [/^react(?:\/|$)/] },
  outExtensions: ({ format }) => ({
    js: format === "es" ? ".mjs" : ".js",
    dts: format === "es" ? ".d.mts" : ".d.ts",
  }),
});
