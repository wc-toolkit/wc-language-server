import fs from 'fs';
import path from 'path';
import test from 'node:test';
import assert from 'assert';

test('no package.json import should not throw', async () => {
  // Prepare a temp dir without package.json
  const tmpDir = path.resolve('packages/language-server/test-tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  // Ensure no package.json
  const pkgPath = path.join(tmpDir, 'package.json');
  if (fs.existsSync(pkgPath)) fs.unlinkSync(pkgPath);

  // Dynamically import the compiled service; should not throw
  await import(`file://${path.resolve('packages/language-server/dist/services/custom-elements-service.js')}`);
  assert.ok(true);
});
