#!/usr/bin/env node
// Assemble a standalone server bundle (dist-server/) from a completed
// `vite build` of packages/repl. The bundle is build/ + a runtime
// package.json; consumers run `npm install --omit=dev` inside it.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(import.meta.url), '../..');
const repl = path.join(root, 'packages/repl');
const out = path.join(root, 'dist-server');

const repl_pkg = JSON.parse(readFileSync(path.join(repl, 'package.json'), 'utf-8'));

// adapter-node output treats npm packages as external, so ship every non-workspace
// dependency; workspace packages are bundled via ssr.noExternal. svelte-check and
// typescript are devDeps but required at runtime by the /api/check endpoint.
const dependencies = {};
for (const [name, version] of Object.entries(repl_pkg.dependencies)) {
	if (!version.startsWith('workspace:')) dependencies[name] = version;
}
for (const name of ['@sveltejs/kit', 'svelte-check', 'typescript']) {
	dependencies[name] = repl_pkg.devDependencies[name];
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(path.join(repl, 'build'), path.join(out, 'build'), { recursive: true });
writeFileSync(
	path.join(out, 'package.json'),
	JSON.stringify(
		{
			name: 'svelte-utils-server',
			private: true,
			type: 'module',
			version: repl_pkg.version,
			dependencies
		},
		null,
		'\t'
	) + '\n'
);

console.log(`dist-server/ ready (${Object.keys(dependencies).length} runtime deps)`);
