import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Disk-backed session store for components pushed by the svelte-utils CLI.
 * Sessions are tiny JSON files in the OS temp dir, so they survive server
 * restarts but get cleaned up with the temp dir eventually.
 */
const dir = path.join(os.tmpdir(), 'svelte-utils-sessions');

const ID_PATTERN = /^[a-z0-9-]{6,64}$/;

export function valid_id(id: string) {
	return ID_PATTERN.test(id);
}

export function save_session(id: string, basename: string, contents: string) {
	mkdirSync(dir, { recursive: true });
	const session = { basename, contents, mtime: Date.now() };
	writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(session));
	return session;
}

export function load_session(id: string) {
	if (!valid_id(id)) return null;
	try {
		return JSON.parse(readFileSync(path.join(dir, `${id}.json`), 'utf-8')) as {
			basename: string;
			contents: string;
			mtime: number;
		};
	} catch {
		return null;
	}
}
