import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/button.tsx"],
  format: ["cjs", "esm"],
  dts: true,
  deps: { neverBundle: [/^react(?:\/|$)/] },
  outExtensions: ({ format }) => ({
    js: format === "es" ? ".mjs" : ".js",
    dts: format === "es" ? ".d.mts" : ".d.ts",
  }),
});
