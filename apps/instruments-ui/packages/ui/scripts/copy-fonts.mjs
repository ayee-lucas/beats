import { cp, mkdir } from "node:fs/promises";

const destination = new URL("../dist/fonts/", import.meta.url);
await mkdir(destination, { recursive: true });
await cp(new URL("../src/fonts/", import.meta.url), destination, { recursive: true });
