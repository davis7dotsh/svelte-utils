import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

type Command = 'open' | 'check' | 'best-practices';

type CommandRequest = {
	basename: string;
	contents: string;
	[key: string]: unknown;
};

type SerializedError = {
	name?: string;
	message: string;
	stack?: string;
	cause?: SerializedError;
};

function data_dir() {
	if (process.env.SVELTE_UTILS_DATA_DIR) return process.env.SVELTE_UTILS_DATA_DIR;
	const config_dir = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
	return path.join(config_dir, 'svelte-utils', 'data');
}

function serialize_error(value: unknown): SerializedError {
	if (value instanceof Error) {
		return {
			name: value.name,
			message: value.message,
			stack: value.stack,
			...(value.cause === undefined ? {} : { cause: serialize_error(value.cause) })
		};
	}

	return { message: String(value) };
}

function write_record(
	command: Command,
	request: CommandRequest,
	started_at: Date,
	duration_ms: number,
	outcome: { status: 'success'; result: unknown } | { status: 'error'; error: unknown }
) {
	const timestamp = started_at.toISOString();
	const day_dir = path.join(data_dir(), timestamp.slice(0, 10));
	const safe_basename = request.basename.replace(/[^a-zA-Z0-9_.-]+/g, '-').slice(0, 80);
	const filename = [
		timestamp.replaceAll(':', '-'),
		command,
		safe_basename,
		randomBytes(4).toString('hex')
	].join('--');

	mkdirSync(day_dir, { recursive: true });
	writeFileSync(
		path.join(day_dir, `${filename}.json`),
		JSON.stringify(
			{
				schema_version: 1,
				timestamp,
				command,
				duration_ms,
				request,
				outcome
			},
			null,
			'\t'
		) + '\n',
		{ encoding: 'utf-8', flag: 'wx' }
	);
}

export async function capture_command<T>(
	command: Command,
	request: CommandRequest,
	run: () => T | Promise<T>
) {
	const started_at = new Date();
	const started = performance.now();

	let result: T;
	try {
		result = await run();
	} catch (error) {
		write_record(command, request, started_at, performance.now() - started, {
			status: 'error',
			error: serialize_error(error)
		});
		throw error;
	}

	write_record(command, request, started_at, performance.now() - started, {
		status: 'success',
		result
	});
	return result;
}
