# svelte-playround-fork

A self-contained fork of the [svelte.dev playground](https://svelte.dev/playground) (extracted from [sveltejs/svelte.dev](https://github.com/sveltejs/svelte.dev)) plus a CLI for quickly test-driving self-contained `.svelte` components.

## Setup

```bash
pnpm install
pnpm link --global   # makes `svelte-utils` available everywhere (optional)
```

## CLI

```bash
svelte-utils open <file.svelte>              # preview in the playground (auto-starts the server)
svelte-utils check <file.svelte>             # run svelte-check (sv check) against the file
svelte-utils best-practices <file.svelte>    # run the official Svelte autofixer (static analysis)
svelte-utils server <start|stop|status>      # manage the always-on playground server
```

- The playground server is a detached daemon on port `5175` (override with `SVELTE_PLAYGROUND_PORT`). `open` starts it on demand; it keeps running until `server stop`.
- Each opened file gets its own URL (`/?file=/abs/path`), so many components can be previewed in parallel tabs.
- Opened files are **watched**: saving the file on disk live-reloads the preview.
- Server logs/pid live in `~/.svelte-playground/`.

## Layout

```
bin/svelte-utils.js       # the CLI
packages/repl/            # the playground (SvelteKit app + @sveltejs/repl library)
packages/site-kit/        # UI kit dependency (workspace)
packages/icons/           # icons dependency (workspace)
packages/gzip/            # tiny site-kit dependency (workspace)
packages/checker/         # hidden workspace used by `svelte-utils check`
```

Local-file preview plumbing: `packages/repl/src/routes/local-file/+server.ts` (serves file contents + mtime) and `packages/repl/src/routes/+page.svelte` (loads it into the REPL and polls for changes).

Note: bundling happens in the browser and fetches svelte + npm imports from a CDN, so previewing needs internet access.
