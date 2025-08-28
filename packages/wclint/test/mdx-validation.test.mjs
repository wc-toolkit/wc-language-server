import test from 'node:test';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { validateFiles } from '../dist/validator.js';

// Create a temporary markdown file with embedded HTML
const tmpDir = path.resolve('test-tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const tmpFile = path.join(tmpDir, 'sample.md');

const mdContent = '# Sample\n\n' +
  'Some text with inline HTML:\n\n' +
  '<div class="my-component">\\n  <my-widget></my-widget>\\n</div>\n\n' +
  'And an HTML fence:\n\n' +
  '```' + 'html\n' +
  '<custom-el attr="value"></custom-el>\n' +
  '```\n';

fs.writeFileSync(tmpFile, mdContent, 'utf8');

test('mdx validation should return diagnostics array', async () => {
  const results = await validateFiles([tmpFile], {}, undefined);
  assert.ok(Array.isArray(results));
  // Clean up
  fs.unlinkSync(tmpFile);
});
