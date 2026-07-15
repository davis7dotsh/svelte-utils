#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(import.meta.url), '../..');
const repl_dir = path.join(root, 'packages/repl');
const checker_dir = path.join(root, 'packages/checker');

const PORT = process.env.SVELTE_PLAYGROUND_PORT || '5175';
const BASE = `http://localhost:${PORT}`;

const state_dir = path.join(os.homedir(), '.svelte-playground');
const pid_file = path.join(state_dir, 'server.pid');
const log_file = path.join(state_dir, 'server.log');

function usage(code = 1) {
	console.log(`svelte-utils — test-drive self-contained .svelte components

Usage:
  svelte-utils open <file.svelte> [--no-open]   preview in the playground (starts server if needed)
  svelte-utils check <file.svelte>              run svelte-check (sv check) on the file
  svelte-utils best-practices <file.svelte>     run the Svelte autofixer (static analysis + suggestions)
  svelte-utils server <start|stop|status>       manage the always-on playground server

The playground server runs on port ${PORT} (override with SVELTE_PLAYGROUND_PORT).
Files opened in the playground are watched: saving on disk live-reloads the preview.`);
	process.exit(code);
}

function resolve_svelte_file(arg) {
	if (!arg || arg.startsWith('--')) usage();
	const abs = path.resolve(arg);
	if (!existsSync(abs)) {
		console.error(`File not found: ${abs}`);
		process.exit(1);
	}
	if (!abs.endsWith('.svelte')) {
		console.error(`Expected a .svelte file, got: ${abs}`);
		process.exit(1);
	}
	return abs;
}

async function is_running() {
	try {
		const res = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(1000) });
		return res.ok;
	} catch {
		return false;
	}
}

async function ensure_server() {
	if (await is_running()) return false;

	mkdirSync(state_dir, { recursive: true });
	const log = openSync(log_file, 'a');
	const child = spawn('pnpm', ['dev', '--port', PORT, '--strictPort'], {
		cwd: repl_dir,
		detached: true,
		stdio: ['ignore', log, log]
	});
	child.unref();
	writeFileSync(pid_file, String(child.pid));

	process.stdout.write(`Starting playground server on ${BASE} `);
	for (let i = 0; i < 60; i++) {
		await new Promise((f) => setTimeout(f, 500));
		if (await is_running()) {
			console.log('✔');
			return true;
		}
		process.stdout.write('.');
	}
	console.error(`\nServer did not come up. Check logs: ${log_file}`);
	process.exit(1);
}

function open_in_browser(url) {
	const opener =
		process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
	spawn(opener, [url], { stdio: 'ignore', detached: true }).unref();
}

async function cmd_open(args) {
	const abs = resolve_svelte_file(args[0]);
	await ensure_server();
	const url = `${BASE}/?file=${encodeURIComponent(abs)}`;
	console.log(url);
	if (!args.includes('--no-open')) open_in_browser(url);
}

function cmd_check(args) {
	const abs = resolve_svelte_file(args[0]);
	const tmp = path.join(checker_dir, '.tmp', `check-${Date.now()}`);
	mkdirSync(tmp, { recursive: true });
	copyFileSync(abs, path.join(tmp, path.basename(abs)));

	try {
		const result = spawnSync('pnpm', ['exec', 'svelte-check', '--workspace', tmp, '--no-tsconfig'], {
			cwd: checker_dir,
			stdio: 'inherit'
		});
		process.exitCode = result.status ?? 1;
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
}

function cmd_best_practices(args) {
	const abs = resolve_svelte_file(args[0]);
	const result = spawnSync('npx', ['-y', '@sveltejs/mcp', 'svelte-autofixer', abs, ...args.slice(1)], {
		stdio: 'inherit'
	});
	process.exitCode = result.status ?? 1;
}

async function cmd_server(args) {
	const action = args[0] ?? 'status';

	if (action === 'status') {
		console.log((await is_running()) ? `running on ${BASE}` : 'not running');
	} else if (action === 'start') {
		if (!(await ensure_server())) console.log(`already running on ${BASE}`);
	} else if (action === 'stop') {
		if (!existsSync(pid_file)) {
			console.log('no pid file; server not managed by this CLI?');
			return;
		}
		const pid = Number(readFileSync(pid_file, 'utf-8'));
		try {
			process.kill(-pid, 'SIGTERM'); // negative pid = whole process group (pnpm + vite)
		} catch {
			try {
				process.kill(pid, 'SIGTERM');
			} catch {
				console.log('process already gone');
			}
		}
		rmSync(pid_file, { force: true });
		console.log('stopped');
	} else {
		usage();
	}
}

const [command, ...rest] = process.argv.slice(2);

switch (command) {
	case 'open':
	case 'playground':
		await cmd_open(rest);
		break;
	case 'check':
		cmd_check(rest);
		break;
	case 'best-practices':
	case 'fix':
		cmd_best_practices(rest);
		break;
	case 'server':
		await cmd_server(rest);
		break;
	case '--help':
	case '-h':
	case 'help':
		usage(0);
		break;
	default:
		if (command) console.error(`Unknown command "${command}"\n`);
		usage();
}
