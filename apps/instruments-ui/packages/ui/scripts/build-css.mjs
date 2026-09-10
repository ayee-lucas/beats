import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { mkdir, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import "./copy-fonts.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = join(root, "src");
const require = createRequire(import.meta.url);
const cli = join(dirname(require.resolve("@tailwindcss/cli/package.json")), "dist/index.mjs");

async function styles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const results = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? styles(path) : path.endsWith(".css") ? [path] : [];
  }));
  return results.flat();
}

async function build() {
  const inputs = [join(source, "theme.css"), ...await styles(join(source, "components")), ...await styles(join(source, "artwork"))];
  for (const input of inputs) {
    const output = join(root, "dist", relative(source, input));
    await mkdir(dirname(output), { recursive: true });
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [cli, "-i", input, "-o", output, "--minify"], { cwd: root, stdio: "inherit" });
      child.on("error", reject);
      child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`CSS build failed: ${input} (${code})`)));
    });
  }
}

await build();
if (process.argv.includes("--watch")) {
  let timer;
  let queue = Promise.resolve();
  watch(source, { recursive: true }, (_event, filename) => {
    if (!filename || !/\.(css|tsx?)$/.test(filename)) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      queue = queue.then(build).catch((error) => console.error(error));
    }, 100);
  });
}
