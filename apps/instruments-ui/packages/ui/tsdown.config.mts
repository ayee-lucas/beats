import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/button.tsx", "src/provider-button.tsx", "src/typography.tsx", "src/record-signal-label.tsx", "src/record.tsx"],
  format: ["cjs", "esm"],
  dts: true,
  deps: { neverBundle: [/^react(?:\/|$)/] },
  plugins: [{
    name: "component-css-imports",
    resolveId(id, importer) {
      if (!id.endsWith(".css") || !importer) return;
      // build-css.mjs compiles this source-relative path into dist.
      const resolved = new URL(id, `file://${importer}`).pathname;
      const path = resolved.slice(resolved.lastIndexOf("/src/") + 5);
      return { id: `./${path}`, external: true };
    },
  }],
  outExtensions: ({ format }) => ({
    js: format === "es" ? ".mjs" : ".js",
    dts: format === "es" ? ".d.mts" : ".d.ts",
  }),
});
