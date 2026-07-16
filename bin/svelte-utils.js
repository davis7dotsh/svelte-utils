#!/usr/bin/env node
// svelte-utils — test-drive self-contained .svelte components.
// Not affiliated with the Svelte team. https://github.com/davis7dotsh/svelte-utils
//
// Dependency-free by design: this single file is the entire client CLI.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '0.3.0';

// ---------------------------------------------------------------------------
// config (~/.svelte-utils, JSON)
// ---------------------------------------------------------------------------

const config_path = path.join(os.homedir(), '.svelte-utils');

function read_config() {
	try {
		return JSON.parse(readFileSync(config_path, 'utf-8'));
	} catch {
		return {};
	}
}

function write_config(config) {
	writeFileSync(config_path, JSON.stringify(config, null, '\t') + '\n');
}

const config = read_config();

/** repo dir, when this CLI lives inside a clone (or `config.repo` points at one) */
function find_repo() {
	if (config.repo && existsSync(path.join(config.repo, 'packages/repl'))) return config.repo;
	try {
		const here = path.resolve(fileURLToPath(import.meta.url), '../..');
		if (existsSync(path.join(here, 'packages/repl'))) return here;
	} catch {
		// installed standalone
	}
	return null;
}

function get_host(args) {
	const flag = args.indexOf('--host');
	if (flag !== -1 && args[flag + 1]) return args[flag + 1].replace(/\/$/, '');
	if (process.env.SVELTE_UTILS_HOST) return process.env.SVELTE_UTILS_HOST.replace(/\/$/, '');
	if (config.host) return String(config.host).replace(/\/$/, '');
	return `http://localhost:${local_port()}`;
}

function local_port() {
	return process.env.SVELTE_PLAYGROUND_PORT || config.port || '7488';
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function usage(code = 1) {
	const host_source = process.env.SVELTE_UTILS_HOST
		? 'SVELTE_UTILS_HOST'
		: config.host
			? '~/.svelte-utils'
			: 'default';
	const extras = Object.entries(config)
		.filter(([key]) => key !== 'host')
		.map(([key, value]) => `${key}=${value}`)
		.join(' ');
	console.log(`svelte-utils v${VERSION} — test-drive self-contained .svelte components
(not affiliated with the Svelte team)

Commands:
  open <file.svelte>            push to the playground and open it
  check <file.svelte>           run svelte-check on it
  best-practices <file.svelte>  run the Svelte autofixer on it
  config                        view or edit ~/.svelte-utils (host, repo, port)
  server                        manage a local dev server
  daemon                        install the server as a systemd service (Linux)
  update                        update this CLI to the latest release

Host: ${get_host([])} (${host_source})${extras ? `\nConfig: ${extras}` : ''}`);
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

async function api(host, method, endpoint, body) {
	let res;
	try {
		res = await fetch(`${host}${endpoint}`, {
			method,
			headers: body ? { 'content-type': 'application/json' } : undefined,
			body: body ? JSON.stringify(body) : undefined,
			signal: AbortSignal.timeout(90_000)
		});
	} catch {
		console.error(`Could not reach playground server at ${host}`);
		console.error(`Is it running? (svelte-utils server start / svelte-utils daemon status)`);
		process.exit(1);
	}
	if (!res.ok) {
		console.error(`Server error ${res.status}: ${await res.text()}`);
		process.exit(1);
	}
	return res.json();
}

function open_in_browser(url) {
	const opener =
		process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
	spawn(opener, [url], { stdio: 'ignore', detached: true }).unref();
}

async function is_running(host) {
	try {
		const res = await fetch(`${host}/`, { signal: AbortSignal.timeout(1500) });
		return res.ok;
	} catch {
		return false;
	}
}

function is_local(host) {
	return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(host);
}

// ---------------------------------------------------------------------------
// local dev server management (requires a repo clone)
// ---------------------------------------------------------------------------

const state_dir = path.join(os.homedir(), '.svelte-utils-state');
const pid_file = path.join(state_dir, 'server.pid');
const log_file = path.join(state_dir, 'server.log');

function require_repo() {
	const repo = find_repo();
	if (!repo) {
		console.error(`This command needs a svelte-utils repo clone.
Clone https://github.com/davis7dotsh/svelte-utils and either run the CLI from
inside it, or set: svelte-utils config set repo /path/to/svelte-utils`);
		process.exit(1);
	}
	return repo;
}

async function start_local_server({ expose = false } = {}) {
	const repo = require_repo();
	const port = local_port();

	mkdirSync(state_dir, { recursive: true });
	const log = openSync(log_file, 'a');
	const child = spawn(
		'pnpm',
		['dev', '--port', port, '--strictPort', ...(expose ? ['--host', '0.0.0.0'] : [])],
		{ cwd: path.join(repo, 'packages/repl'), detached: true, stdio: ['ignore', log, log] }
	);
	child.unref();
	writeFileSync(pid_file, String(child.pid));

	const base = `http://localhost:${port}`;
	process.stdout.write(`Starting playground server on ${base}${expose ? ' (exposed on 0.0.0.0)' : ''} `);
	for (let i = 0; i < 60; i++) {
		await new Promise((f) => setTimeout(f, 500));
		if (await is_running(base)) {
			console.log('✔');
			return;
		}
		process.stdout.write('.');
	}
	console.error(`\nServer did not come up. Check logs: ${log_file}`);
	process.exit(1);
}

// ---------------------------------------------------------------------------
// commands
// ---------------------------------------------------------------------------

async function cmd_open(args) {
	const abs = resolve_svelte_file(args[0]);
	const host = get_host(args);

	if (!(await is_running(host))) {
		if (is_local(host) && find_repo()) {
			await start_local_server();
		} else {
			console.error(`Playground server at ${host} is not reachable.`);
			process.exit(1);
		}
	}

	// deterministic id: re-running `open` on the same file updates the same
	// session, and any open browser tab picks up the change within a second
	const id = createHash('sha256')
		.update(`${os.hostname()}:${realpathSync(abs)}`)
		.digest('hex')
		.slice(0, 16);

	await api(host, 'POST', '/api/session', {
		id,
		basename: path.basename(abs),
		contents: readFileSync(abs, 'utf-8')
	});

	const url = `${host}/?s=${id}`;
	console.log(url);
	if (!args.includes('--no-open')) open_in_browser(url);
}

async function cmd_check(args) {
	const abs = resolve_svelte_file(args[0]);
	const host = get_host(args);
	const result = await api(host, 'POST', '/api/check', {
		basename: path.basename(abs),
		contents: readFileSync(abs, 'utf-8')
	});

	if (args.includes('--json')) {
		console.log(JSON.stringify(result, null, 2));
	} else {
		for (const d of result.diagnostics) {
			console.log(
				`${d.type.toLowerCase()} ${path.basename(abs)}:${d.start.line + 1}:${d.start.character + 1} ${d.message} (${d.source})`
			);
		}
		const s = result.summary ?? { errors: 0, warnings: 0 };
		console.log(`${s.errors} errors, ${s.warnings} warnings`);
	}

	process.exitCode = result.diagnostics.some((d) => d.type === 'ERROR') ? 1 : 0;
}

async function cmd_best_practices(args) {
	const abs = resolve_svelte_file(args[0]);
	const host = get_host(args);
	const result = await api(host, 'POST', '/api/autofix', {
		basename: path.basename(abs),
		contents: readFileSync(abs, 'utf-8')
	});

	if (args.includes('--json')) {
		console.log(JSON.stringify(result, null, 2));
	} else {
		if (result.issues.length === 0 && result.suggestions.length === 0) {
			console.log('No issues or suggestions 🎉');
		}
		for (const issue of result.issues) console.log(`issue: ${issue}\n`);
		for (const s of result.suggestions) console.log(`suggestion: ${s}\n`);
	}

	process.exitCode = result.issues.length > 0 ? 1 : 0;
}

function cmd_config(args) {
	const [action, key, value] = args;
	if (!action) {
		console.log(`config file: ${config_path}`);
		console.log(JSON.stringify(config, null, '\t'));
	} else if (action === 'set' && key && value !== undefined) {
		config[key] = value;
		write_config(config);
		console.log(`${key} = ${value}`);
	} else if (action === 'unset' && key) {
		delete config[key];
		write_config(config);
		console.log(`unset ${key}`);
	} else {
		usage();
	}
}

async function cmd_server(args) {
	const action = args[0] ?? 'status';
	const base = `http://localhost:${local_port()}`;

	if (action === 'status') {
		console.log((await is_running(base)) ? `running on ${base}` : 'not running');
	} else if (action === 'start') {
		if (await is_running(base)) console.log(`already running on ${base}`);
		else await start_local_server({ expose: args.includes('--expose') });
	} else if (action === 'stop') {
		if (!existsSync(pid_file)) {
			console.log('no pid file; server not managed by this CLI?');
			return;
		}
		const pid = Number(readFileSync(pid_file, 'utf-8'));
		try {
			process.kill(-pid, 'SIGTERM'); // negative pid = whole process group
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

// ---------------------------------------------------------------------------
// daemon: production build + systemd service (Linux) — run this on the core box
// ---------------------------------------------------------------------------

const unit_path = path.join(os.homedir(), '.config/systemd/user/svelte-utils.service');

function systemctl(...args) {
	return spawnSync('systemctl', ['--user', ...args], { stdio: 'inherit' });
}

async function cmd_daemon(args) {
	const action = args[0] ?? 'status';

	if (action === 'status') {
		systemctl('status', 'svelte-utils', '--no-pager');
		return;
	}
	if (action === 'logs') {
		spawnSync('journalctl', ['--user', '-u', 'svelte-utils', '-n', '100', '--no-pager'], {
			stdio: 'inherit'
		});
		return;
	}
	if (action === 'uninstall') {
		systemctl('disable', '--now', 'svelte-utils');
		rmSync(unit_path, { force: true });
		systemctl('daemon-reload');
		console.log('svelte-utils service removed');
		return;
	}
	if (action !== 'install') usage();

	if (process.platform !== 'linux') {
		console.error('daemon install currently supports Linux (systemd) only.');
		console.error('On other platforms use: svelte-utils server start --expose');
		process.exit(1);
	}

	const repo = require_repo();
	const port = local_port();
	const repl = path.join(repo, 'packages/repl');

	console.log('Installing dependencies + building production server...');
	let r = spawnSync('pnpm', ['install'], { cwd: repo, stdio: 'inherit' });
	if (r.status !== 0) process.exit(r.status ?? 1);
	r = spawnSync('pnpm', ['exec', 'vite', 'build'], { cwd: repl, stdio: 'inherit' });
	if (r.status !== 0) process.exit(r.status ?? 1);

	const node = process.execPath;
	mkdirSync(path.dirname(unit_path), { recursive: true });
	writeFileSync(
		unit_path,
		`[Unit]
Description=svelte-utils playground core (not affiliated with the Svelte team)
After=network.target

[Service]
WorkingDirectory=${repl}
ExecStart=${node} build/index.js
Environment=PORT=${port}
Environment=HOST=0.0.0.0
Environment=ORIGIN=http://%H:${port}
Restart=on-failure
RestartSec=2

[Install]
WantedBy=default.target
`
	);

	systemctl('daemon-reload');
	r = systemctl('enable', '--now', 'svelte-utils');
	if (r.status !== 0) process.exit(r.status ?? 1);

	config.host = `http://localhost:${port}`;
	config.repo = repo;
	write_config(config);

	console.log(`\nsvelte-utils core installed and running on 0.0.0.0:${port}`);
	console.log(`This machine's config now points at it (${config.host}).`);
	console.log(`\nTo keep it running after logout: sudo loginctl enable-linger ${os.userInfo().username}`);
	console.log(`On other machines: svelte-utils config set host http://<this-machine>:${port}`);
}

// ---------------------------------------------------------------------------
// update: replace this script with the latest GitHub release
// ---------------------------------------------------------------------------

async function cmd_update() {
	const self = realpathSync(fileURLToPath(import.meta.url));

	if (existsSync(path.join(path.dirname(self), '../packages/repl'))) {
		console.error(`This CLI is running from a repo clone (${path.dirname(path.dirname(self))}).`);
		console.error('Update it with git pull instead.');
		process.exit(1);
	}

	const url = 'https://github.com/davis7dotsh/svelte-utils/releases/latest/download/svelte-utils.js';
	console.log(`Checking ${url}`);
	let res;
	try {
		res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30_000) });
	} catch {
		console.error('Could not reach GitHub. Check your connection and try again.');
		process.exit(1);
	}
	if (!res.ok) {
		console.error(`Download failed (${res.status})`);
		process.exit(1);
	}
	const contents = await res.text();

	const latest = contents.match(/^const VERSION = '([^']+)';$/m)?.[1];
	if (!latest || !contents.startsWith('#!')) {
		console.error('Downloaded file does not look like the svelte-utils CLI; not installing it.');
		process.exit(1);
	}
	if (latest === VERSION) {
		console.log(`Already up to date (v${VERSION})`);
		return;
	}

	// write to a temp file next to the target, then rename (atomic on same fs)
	const tmp = `${self}.${process.pid}.new`;
	try {
		writeFileSync(tmp, contents, { mode: 0o755 });
		renameSync(tmp, self);
	} catch (err) {
		rmSync(tmp, { force: true });
		console.error(`Could not replace ${self}: ${err.message}`);
		process.exit(1);
	}
	console.log(`Updated v${VERSION} → v${latest} (${self})`);
}

// ---------------------------------------------------------------------------

const [command, ...rest] = process.argv.slice(2);

switch (command) {
	case 'open':
	case 'playground':
		await cmd_open(rest);
		break;
	case 'check':
		await cmd_check(rest);
		break;
	case 'best-practices':
	case 'fix':
		await cmd_best_practices(rest);
		break;
	case 'config':
		cmd_config(rest);
		break;
	case 'server':
		await cmd_server(rest);
		break;
	case 'daemon':
		await cmd_daemon(rest);
		break;
	case 'update':
	case 'upgrade':
		await cmd_update();
		break;
	case '--version':
	case '-v':
		console.log(VERSION);
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
