import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RequestProgress } from '../components/request-progress';

test('hosted requests show LQH status, elapsed time and startup guidance together', () => {
  const message = 'If the model needs to start up, the first response may take a few minutes.';
  const html = renderToStaticMarkup(createElement(RequestProgress, { busy: true, hosted: true, message }));
  assert.match(html, /LQH/);
  assert.match(html, /role="timer"/);
  assert.match(html, /0:00 elapsed/);
  assert.ok(html.includes(message));
});

test('idle hosted status remains visible without a stale timer or progress message', () => {
  const html = renderToStaticMarkup(createElement(RequestProgress, { busy: false, hosted: true, message: 'stale message' }));
  assert.match(html, /LQH/);
  assert.doesNotMatch(html, /role="timer"|stale message/);
});

test('browser inference keeps its own progress without an LQH indicator', () => {
  const html = renderToStaticMarkup(createElement(RequestProgress, { busy: true, message: 'Loading browser model…' }));
  assert.match(html, /Loading browser model/);
  assert.match(html, /role="timer"/);
  assert.doesNotMatch(html, /LQH/);
  assert.equal(renderToStaticMarkup(createElement(RequestProgress, { busy: false, message: '' })), '');
});
