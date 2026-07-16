# svelte-utils

Test-drive self-contained `.svelte` components from the terminal: preview them in a locally hosted [Svelte playground](https://svelte.dev/playground), run `svelte-check`, and run the official Svelte autofixer. One dependency-free CLI, talking to a "core" server that can live on any machine on your network.

> **Not affiliated with the Svelte team.** Independent project reusing the MIT-licensed playground from [sveltejs/svelte.dev](https://github.com/sveltejs/svelte.dev) and the [`@sveltejs/mcp`](https://www.npmjs.com/package/@sveltejs/mcp) autofixer.

## Commands

| Command | What it does |
| --- | --- |
| `open <file.svelte>` | Push the file to the playground and open it in the browser. Re-running after an edit updates the already-open tab. |
| `check <file.svelte>` | Run `svelte-check` on it (exit 1 on errors). `--json` for machine-readable output. |
| `best-practices <file.svelte>` | Run the Svelte autofixer on it (exit 1 on issues). `--json` too. |
| `config` | View or edit `~/.svelte-utils` (`host`, `repo`, `port`). |
| `server <start\|stop\|status>` | Manage a throwaway local dev server (needs a repo clone). |
| `daemon <install\|uninstall\|status\|logs>` | Install the core as a systemd service (Linux, needs a repo clone). |
| `update` (alias `upgrade`) | Update the CLI to the latest release. |

## Install

**CLI (any machine, Node 20+):**

```bash
curl -fsSL https://davis7dotsh.github.io/svelte-utils/install.sh | sh
```

**Core (the server machine):**

```bash
git clone https://github.com/davis7dotsh/svelte-utils
cd svelte-utils && pnpm install
svelte-utils daemon install
```

**Point other machines at it:**

```bash
svelte-utils config set host http://<core-machine>:7488
```

## License

[MIT](./LICENSE). Includes MIT-licensed code from [sveltejs/svelte.dev](https://github.com/sveltejs/svelte.dev).
