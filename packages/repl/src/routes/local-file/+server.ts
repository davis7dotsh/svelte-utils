import { json, error } from '@sveltejs/kit';
import { readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';

/**
 * Dev-only endpoint: serves a local .svelte file so the playground can preview it.
 * The path comes from the `?path=` query param (set by the `svelte-utils open` CLI
 * via the page's `?file=` param), falling back to the PLAYGROUND_FILE env var.
 */
export function GET({ url }) {
	const file = url.searchParams.get('path') ?? process.env.PLAYGROUND_FILE;
	if (!file) error(404, 'no file requested');
	if (!file.endsWith('.svelte')) error(400, 'only .svelte files are supported');

	try {
		const contents = readFileSync(file, 'utf-8');
		const { mtimeMs } = statSync(file);
		return json({ basename: basename(file), contents, mtime: mtimeMs });
	} catch (e) {
		error(500, `could not read ${file}: ${(e as Error).message}`);
	}
}
