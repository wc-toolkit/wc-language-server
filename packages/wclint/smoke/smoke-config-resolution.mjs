/* eslint-disable no-undef */
import { spawnSync } from 'child_process';
import path from 'path';

const cli = path.resolve(process.cwd(), 'packages/cli/dist/cli.js');
const demoConfig = 'packages/cli/demo/wc.config.js';

// Run from repo root and from demo folder to ensure resolution works both ways
let res = spawnSync('node', [cli, 'validate', '--config', demoConfig, 'packages/cli/demo/*.html'], { stdio: 'inherit', shell: true });
res = spawnSync('node', [cli, 'validate', '--config', demoConfig, 'packages/cli/demo/*.html'], { cwd: 'packages/cli/demo', stdio: 'inherit', shell: true });
process.exit(res.status || 0);
