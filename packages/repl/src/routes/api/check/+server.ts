import { json, error } from '@sveltejs/kit';
import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { capture_command } from '$lib/server/command-log';

const exec = promisify(execFile);
const require = createRequire(import.meta.url);

function svelte_check_bin() {
	const pkg_path = require.resolve('svelte-check/package.json');
	const pkg = require('svelte-check/package.json');
	const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin['svelte-check'];
	return path.join(path.dirname(pkg_path), bin);
}

/** Run svelte-check on a single component: `{ basename, contents }` → diagnostics */
export async function POST({ request }) {
	const body = await request.json().catch(() => null);
	if (!body || typeof body.contents !== 'string') error(400, 'expected JSON body with `contents`');

	const basename =
		typeof body.basename === 'string' && /^[\w.-]+\.svelte$/.test(body.basename)
			? body.basename
			: 'App.svelte';

	const request_data = { basename, contents: body.contents };
	const result = await capture_command('check', request_data, async () => {
		const tmp = mkdtempSync(path.join(os.tmpdir(), 'svelte-utils-check-'));
		writeFileSync(path.join(tmp, basename), body.contents);

		try {
			const { stdout } = await exec(
				process.execPath,
				[svelte_check_bin(), '--workspace', tmp, '--no-tsconfig', '--output', 'machine-verbose'],
				{ timeout: 60_000 }
			).catch((e) => e as { stdout: string }); // non-zero exit just means diagnostics were found

			const diagnostics = [];
			let summary = null;

			for (const line of String(stdout).split('\n')) {
				const start = line.indexOf(' ');
				const rest = line.slice(start + 1);
				if (rest.startsWith('{')) {
					try {
						diagnostics.push(JSON.parse(rest));
					} catch {
						// ignore unparseable rows
					}
				} else if (rest.startsWith('COMPLETED')) {
					const [, files, , errors, , warnings] = rest.split(' ');
					summary = { files: +files, errors: +errors, warnings: +warnings };
				}
			}

			return { diagnostics, summary };
		} finally {
			rmSync(tmp, { recursive: true, force: true });
		}
	});

	return json(result);
}
