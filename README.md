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
| `server <start\|stop\|status>` | Manage a local server (downloads a prebuilt bundle; uses a repo clone if you have one). |
| `daemon <install\|uninstall\|status\|logs>` | Install the core as a systemd service (Linux). No repo clone needed. |
| `update` (alias `upgrade`) | Update the CLI — and this machine's server/daemon, if it runs one — to the latest release. |

## Install

**CLI (any machine, Node 20+):**

```bash
curl -fsSL https://davis7dotsh.github.io/svelte-utils/install.sh | sh
```

**Core (the server machine):** install the CLI the same way, then:

```bash
svelte-utils daemon install
```

This downloads a prebuilt server bundle and installs it as a systemd service on `0.0.0.0:7488`. Later `svelte-utils update` runs update the server too and restart the daemon.

**Point other machines at it:**

```bash
svelte-utils config set host http://<core-machine>:7488
```

## License

[MIT](./LICENSE). Includes MIT-licensed code from [sveltejs/svelte.dev](https://github.com/sveltejs/svelte.dev).
