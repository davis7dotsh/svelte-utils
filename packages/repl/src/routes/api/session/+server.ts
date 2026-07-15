import { json, error } from '@sveltejs/kit';
import { randomBytes } from 'node:crypto';
import { save_session, valid_id } from '$lib/server/sessions';

/** Push a component: `{ id?, basename, contents }` → `{ id, url }` */
export async function POST({ request, url }) {
	const body = await request.json().catch(() => null);
	if (!body || typeof body.contents !== 'string') error(400, 'expected JSON body with `contents`');

	const id = body.id ?? randomBytes(8).toString('hex');
	if (!valid_id(id)) error(400, 'invalid session id (want [a-z0-9-]{6,64})');

	const basename = typeof body.basename === 'string' ? body.basename : 'App.svelte';
	save_session(id, basename, body.contents);

	return json({ id, url: `${url.origin}/?s=${id}` });
}
