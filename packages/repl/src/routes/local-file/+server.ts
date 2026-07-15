import { json, error } from '@sveltejs/kit';
import { readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';

/** Dev-only endpoint: serves the local .svelte file passed to the CLI via PLAYGROUND_FILE */
export function GET() {
	const file = process.env.PLAYGROUND_FILE;
	if (!file) error(404, 'no PLAYGROUND_FILE set');

	try {
		const contents = readFileSync(file, 'utf-8');
		const { mtimeMs } = statSync(file);
		return json({ basename: basename(file), contents, mtime: mtimeMs });
	} catch (e) {
		error(500, `could not read ${file}: ${(e as Error).message}`);
	}
}
