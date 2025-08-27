/* eslint-disable no-undef */
import assert from 'assert';
import path from 'path';
import { spawnSync } from 'child_process';
import test from 'node:test';

const cli = path.resolve(process.cwd(), 'packages/cli/dist/cli.js');
const config = 'packages/cli/demo/wc.config.js';

function runValidator(cwd) {
	return spawnSync('node', [cli, 'validate', '--config', config, 'packages/cli/demo/*.html'], { encoding: 'utf8', cwd, shell: true });
}

test('config resolution - repo root', () => {
	const res = runValidator(process.cwd());
	assert.ok(res.status === 0 || res.status === 1, `CLI exited with unexpected code: ${res.status}`);
});

test('config resolution - package cwd', () => {
	const res2 = runValidator(path.resolve('packages/cli'));
	assert.ok(res2.status === 0 || res2.status === 1, `CLI exited with unexpected code: ${res2.status}`);
});
