import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'grocery-setup-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const demo = join(root, 'demos/local_demo');
  const bin = join(root, 'bin');
  mkdirSync(join(demo, 'scripts'), { recursive: true });
  mkdirSync(join(root, 'models'));
  mkdirSync(bin);
  for (const name of ['setup.sh', 'start-local.sh']) {
    copyFileSync(
      new URL(`../scripts/${name}`, import.meta.url),
      join(demo, 'scripts', name),
    );
  }
  writeFileSync(join(demo, '.env.example'), 'kroger_client_id=\n');
  for (const name of [
    'grocery-list-v3-q4.gguf',
    'LFM2.5-1.2B-Instruct-Q4_K_M.gguf',
  ]) {
    writeFileSync(join(root, 'models', name), 'test fixture; never loaded');
  }
  symlinkSync(process.execPath, join(bin, 'node'));
  writeFileSync(
    join(bin, 'npm'),
    '#!/bin/sh\nprintf "%s\\n" "$*" >> "$SETUP_NPM_LOG"\n',
    { mode: 0o755 },
  );
  const env = {
    ...process.env,
    PATH: `${bin}:/usr/bin:/bin`,
    SETUP_NPM_LOG: join(root, 'npm.log'),
  };
  delete env.LLAMA_SERVER_BIN;
  return { root, demo, bin, env };
}

function engine(path) {
  writeFileSync(path, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
}

void test('fresh setup finds a PATH engine, installs dependencies, and preserves an existing env', (t) => {
  const { root, demo, bin, env } = fixture(t);
  engine(join(bin, 'llama-server'));
  const run = () =>
    execFileSync('/bin/bash', ['scripts/setup.sh'], {
      cwd: demo,
      env,
      encoding: 'utf8',
    });
  assert.match(run(), /Setup complete/);
  assert.equal(
    readFileSync(join(demo, '.env.local'), 'utf8'),
    'kroger_client_id=\n',
  );
  writeFileSync(
    join(demo, '.env.local'),
    'kroger_client_id=keep-this-test-value\n',
  );
  run();
  assert.equal(
    readFileSync(join(demo, '.env.local'), 'utf8'),
    'kroger_client_id=keep-this-test-value\n',
  );
  assert.equal(readFileSync(join(root, 'npm.log'), 'utf8'), 'ci\nci\n');
});

void test('launcher supports the existing local engine and an explicit override', (t) => {
  const { demo, bin, env } = fixture(t);
  const localBin = join(demo, '.runtime/llama/build/bin');
  mkdirSync(localBin, { recursive: true });
  engine(join(localBin, 'llama-server'));
  const check = (extra = {}) =>
    spawnSync('/bin/bash', ['scripts/start-local.sh', '--check'], {
      cwd: demo,
      env: { ...env, ...extra },
      encoding: 'utf8',
    });
  assert.equal(check().status, 0);
  engine(join(bin, 'custom-server'));
  assert.equal(
    check({ LLAMA_SERVER_BIN: join(bin, 'custom-server') }).status,
    0,
  );
  assert.equal(
    check({ LLAMA_SERVER_BIN: join(bin, 'missing-server') }).status,
    1,
  );
});

void test('missing engine and models are reported without starting any server', (t) => {
  const { root, demo, env } = fixture(t);
  rmSync(join(root, 'models/grocery-list-v3-q4.gguf'));
  const result = spawnSync('/bin/bash', ['scripts/start-local.sh', '--check'], {
    cwd: demo,
    env,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /llama-server not found/);
  assert.match(result.stdout, /Model not found:.*grocery-list-v3-q4.gguf/);
});
