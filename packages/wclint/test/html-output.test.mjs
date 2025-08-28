import test from 'node:test';
import assert from 'assert';
import fs from 'fs';
import path from 'path';

const { runValidate } = await import('../dist/cli.js');

test('writes HTML report when output ends with .html', async () => {
  const outDir = path.resolve('test-tmp');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'report.html');

  try {
    const code = await runValidate([], { output: outFile, format: undefined });
    assert.ok(code === 0 || code === 1, `unexpected exit code: ${code}`);
    const content = fs.readFileSync(outFile, 'utf8');
    assert.ok(content.includes('<h1>wclint report</h1>'), 'HTML report missing title');
  } finally {
    if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
  }
});
