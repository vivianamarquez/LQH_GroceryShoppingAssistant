import { cp, mkdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const destination = new URL('public/wllama/', root);
await mkdir(destination, { recursive: true });
await cp(new URL('node_modules/@wllama/wllama/esm/wasm/', root), destination, { recursive: true });
