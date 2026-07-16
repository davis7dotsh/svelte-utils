# svelte-utils

Test-drive self-contained `.svelte` components: preview them in a locally hosted [Svelte playground](https://svelte.dev/playground), run `svelte-check` on them, and run the official Svelte autofixer — all from one dependency-free CLI, against a "core" server that can live on any machine on your network.

> **Not affiliated with the Svelte team.** This is an independent project that reuses the MIT-licensed playground from [sveltejs/svelte.dev](https://github.com/sveltejs/svelte.dev) and the [`@sveltejs/mcp`](https://www.npmjs.com/package/@sveltejs/mcp) autofixer. All credit for those to the Svelte contributors.

## Install the CLI (any machine)

```bash
curl -fsSL https://davis7dotsh.github.io/svelte-utils/install.sh | sh
```

The CLI is a single dependency-free Node script — Node 20+ is the only requirement. Update it later with `svelte-utils update` (alias: `upgrade`).

## Set up the core (the server machine)

```bash
git clone https://github.com/davis7dotsh/svelte-utils
cd svelte-utils && pnpm install
svelte-utils daemon install     # builds + installs a systemd service on 0.0.0.0:7488, starts at boot
sudo loginctl enable-linger $USER   # keep it running after logout
```

Or for a throwaway local dev server instead: `svelte-utils server start [--expose]`.

## Point other machines at it

```bash
svelte-utils config set host http://siva:7488
```

Host resolution order: `--host` flag → `SVELTE_UTILS_HOST` env → `host` in `~/.svelte-utils` → `http://localhost:7488`.

## Use it

```bash
svelte-utils open Component.svelte             # push + open in the playground
svelte-utils check Component.svelte [--json]   # svelte-check diagnostics (exit 1 on errors)
svelte-utils best-practices Component.svelte [--json]  # Svelte autofixer (exit 1 on issues)
```

- `open` pushes the file contents to the core and opens `http://<host>/?s=<id>`. The session id is deterministic per file+machine, so re-running `open` after editing **updates the already-open browser tab** (it polls for changes every second).
- `check` and `best-practices` also run on the core — clients need nothing installed besides the CLI. `--json` gives machine-readable output for pipelines.

## How it fits together

```
laptop ── svelte-utils open Foo.svelte ──► core (siva)
                                            ├── POST /api/session   (stores contents, tmp-dir backed)
                                            ├── POST /api/check     (svelte-check in a temp workspace)
                                            ├── POST /api/autofix   (@sveltejs/mcp svelteAutofixer)
                                            └── GET  /?s=<id>       (playground page, polls session)
browser ◄── opens http://siva:7488/?s=<id> ──┘
```

The playground itself compiles and bundles **in the browser** (compiler + Rollup in web workers, npm imports fetched from a CDN), so the core stays lightweight.

## Repo layout

```
bin/svelte-utils.js   # the entire CLI (dependency-free)
packages/repl/        # the playground app + session/check/autofix API (SvelteKit, adapter-node)
packages/site-kit/    # UI kit (from sveltejs/svelte.dev)
packages/icons/       # icons (from sveltejs/svelte.dev)
packages/gzip/        # small site-kit dep (from sveltejs/svelte.dev)
site/                 # GitHub Pages homepage + install.sh
```

## License

[MIT](./LICENSE). Includes MIT-licensed code from [sveltejs/svelte.dev](https://github.com/sveltejs/svelte.dev).
