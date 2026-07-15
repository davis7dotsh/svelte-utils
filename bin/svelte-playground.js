#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const command = args[0];

function usage(code = 1) {
	console.log(`Usage:
  svelte-playground open <file.svelte> [--port <port>] [--no-open]

Opens a local .svelte file in the Svelte playground dev server.
The file is watched: saving it on disk reloads the playground.`);
	process.exit(code);
}

if (command === '--help' || command === '-h' || !command) usage(command ? 0 : 1);
if (command !== 'open') {
	console.error(`Unknown command "${command}"\n`);
	usage();
}

const file = args[1];
if (!file || file.startsWith('--')) usage();

const abs = path.resolve(file);
if (!existsSync(abs)) {
	console.error(`File not found: ${abs}`);
	process.exit(1);
}
if (!abs.endsWith('.svelte')) {
	console.error(`Expected a .svelte file, got: ${abs}`);
	process.exit(1);
}

const port_index = args.indexOf('--port');
const port = port_index !== -1 ? args[port_index + 1] : null;
const auto_open = !args.includes('--no-open');

const repl_dir = path.resolve(fileURLToPath(import.meta.url), '../../packages/repl');

console.log(`Loading ${abs}`);

const child = spawn('pnpm', ['dev', ...(port ? ['--port', port] : [])], {
	cwd: repl_dir,
	env: { ...process.env, PLAYGROUND_FILE: abs },
	stdio: ['ignore', 'pipe', 'inherit']
});

let opened = false;

child.stdout.on('data', (chunk) => {
	process.stdout.write(chunk);

	if (opened || !auto_open) return;
	// eslint-disable-next-line no-control-regex
	const text = chunk.toString().replace(/\u001b\[[0-9;]*m/g, '');
	const match = text.match(/Local:\s+(http:\/\/\S+)/);
	if (match) {
		opened = true;
		const opener =
			process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
		spawn(opener, [match[1]], { stdio: 'ignore', detached: true }).unref();
	}
});

child.on('exit', (code) => process.exit(code ?? 0));
