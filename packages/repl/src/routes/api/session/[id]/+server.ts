import { json, error } from '@sveltejs/kit';
import { load_session } from '$lib/server/sessions';

export function GET({ params }) {
	const session = load_session(params.id);
	if (!session) error(404, `no session "${params.id}"`);
	return json(session);
}
