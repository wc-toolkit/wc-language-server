/* eslint-disable no-undef */
import { spawnSync } from 'child_process';
import path from 'path';

const cli = path.resolve(process.cwd(), 'packages/cli/dist/cli.js');
const demoConfig = 'packages/cli/demo/wc.config.js';
const args = ['validate', '--config', demoConfig, 'packages/cli/demo/*.html'];

const res = spawnSync('node', [cli, ...args], { stdio: 'inherit', shell: true });
process.exit(res.status || 0);
