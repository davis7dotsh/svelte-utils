import { json, error } from '@sveltejs/kit';
import { svelteAutofixer } from '@sveltejs/mcp';
import { capture_command } from '$lib/server/command-log';

/** Run the official Svelte autofixer: `{ contents, svelte_version?, async?, basename? }` */
export async function POST({ request }) {
	const body = await request.json().catch(() => null);
	if (!body || typeof body.contents !== 'string') error(400, 'expected JSON body with `contents`');

	const request_data = {
		basename: typeof body.basename === 'string' ? body.basename : 'App.svelte',
		contents: body.contents,
		svelte_version: body.svelte_version ?? 5,
		async: body.async ?? false
	};
	const result = await capture_command('best-practices', request_data, () => {
		return svelteAutofixer({
			code: request_data.contents,
			desired_svelte_version: request_data.svelte_version,
			async: request_data.async,
			filename: request_data.basename
		});
	});

	return json(result);
}
