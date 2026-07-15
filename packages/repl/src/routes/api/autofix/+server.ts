import { json, error } from '@sveltejs/kit';
import { svelteAutofixer } from '@sveltejs/mcp';

/** Run the official Svelte autofixer: `{ contents, svelte_version?, async?, basename? }` */
export async function POST({ request }) {
	const body = await request.json().catch(() => null);
	if (!body || typeof body.contents !== 'string') error(400, 'expected JSON body with `contents`');

	const result = await svelteAutofixer({
		code: body.contents,
		desired_svelte_version: body.svelte_version ?? 5,
		async: body.async ?? false,
		filename: typeof body.basename === 'string' ? body.basename : 'App.svelte'
	});

	return json(result);
}
