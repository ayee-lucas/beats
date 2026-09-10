import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { mkdir, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = fileURLToPath(new URL("../", import.meta.url));
const SOURCE_DIRECTORY = join(PACKAGE_ROOT, "src");
const OUTPUT_DIRECTORY = join(PACKAGE_ROOT, "dist");
const COMPONENT_DIRECTORIES = ["components", "artwork"];
const WATCH_DEBOUNCE_MS = 100;
const WATCHED_FILE_PATTERN = /\.(css|tsx?)$/;

const require = createRequire(import.meta.url);
const TAILWIND_CLI = join(
  dirname(require.resolve("@tailwindcss/cli/package.json")),
  "dist/index.mjs",
);

async function findStylesheets(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const stylesheets = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      stylesheets.push(...await findStylesheets(path));
    } else if (entry.isFile() && entry.name.endsWith(".css")) {
      stylesheets.push(path);
    }
  }

  return stylesheets.sort();
}

async function getBuildInputs() {
  const inputs = [join(SOURCE_DIRECTORY, "theme.css")];
  for (const directory of COMPONENT_DIRECTORIES) {
    inputs.push(...await findStylesheets(join(SOURCE_DIRECTORY, directory)));
  }
  return inputs;
}

async function compileStylesheet(input) {
  const sourcePath = relative(SOURCE_DIRECTORY, input);
  const output = join(OUTPUT_DIRECTORY, sourcePath);
  await mkdir(dirname(output), { recursive: true });

  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [TAILWIND_CLI, "-i", input, "-o", output, "--minify"],
      { cwd: PACKAGE_ROOT, stdio: "inherit" },
    );

    child.once("error", (cause) => {
      reject(new Error(`Could not start Tailwind for ${sourcePath}`, { cause }));
    });
    child.once("close", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      const reason = signal ? `signal ${signal}` : `exit code ${code}`;
      reject(new Error(`CSS build failed for ${sourcePath} (${reason})`));
    });
  });
}

async function buildStylesheets() {
  // Compile sequentially to keep diagnostics ordered and resource use bounded.
  for (const input of await getBuildInputs()) {
    await compileStylesheet(input);
  }
}

function reportError(error) {
  console.error("[build-css]", error);
}

function watchStylesheets() {
  let debounceTimer;
  let building = false;
  let rebuildPending = false;

  async function rebuild() {
    // Keep at most one pending build while the compiler is running.
    rebuildPending = true;
    if (building) return;

    building = true;
    try {
      while (rebuildPending) {
        rebuildPending = false;
        try {
          await buildStylesheets();
        } catch (error) {
          // A CSS error must not stop watching; the next edit can fix it.
          reportError(error);
        }
      }
    } finally {
      building = false;
    }
  }

  const watcher = watch(
    SOURCE_DIRECTORY,
    { recursive: true },
    (_event, filename) => {
      // Missing filenames are allowed by fs.watch; conservatively rebuild.
      if (filename && !WATCHED_FILE_PATTERN.test(filename)) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(rebuild, WATCH_DEBOUNCE_MS);
    },
  );

  watcher.once("error", (error) => {
    clearTimeout(debounceTimer);
    watcher.close();
    reportError(error);
    process.exitCode = 1;
  });

  // Install the watcher before the first build so startup edits are observed.
  return rebuild();
}

async function main() {
  // Font assets are copied once per invocation, not on every CSS rebuild.
  await import("./copy-fonts.mjs");

  if (process.argv.includes("--watch")) {
    await watchStylesheets();
  } else {
    await buildStylesheets();
  }
}

await main().catch((error) => {
  reportError(error);
  process.exitCode = 1;
});
