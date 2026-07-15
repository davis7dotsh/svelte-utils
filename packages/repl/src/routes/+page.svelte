<script lang="ts">
	import Repl from '$lib/Repl.svelte';
	import { onMount } from 'svelte';
	import '@sveltejs/site-kit/styles/index.css';

	let repl: ReturnType<typeof Repl>;

	const fallback =
		'<script>\n\tlet count = $state(0);\n\n\tfunction increment() {\n\t\tcount += 1;\n\t}\n</scr' +
		'ipt>\n\n<button onclick={increment}>\n\tclicks: {count}\n</button>';

	function set_contents(contents: string) {
		repl.set({
			files: [
				{
					type: 'file',
					name: 'App.svelte',
					basename: 'App.svelte',
					contents,
					text: true
				}
			]
		});
	}

	onMount(() => {
		let mtime = 0;
		let interval: ReturnType<typeof setInterval> | undefined;

		async function load(initial: boolean) {
			try {
				const res = await fetch('/local-file');
				if (!res.ok) throw new Error(await res.text());
				const data = await res.json();
				if (data.mtime !== mtime) {
					mtime = data.mtime;
					set_contents(data.contents);
				}
			} catch {
				// no local file provided (or it disappeared) — fall back to the demo once
				if (initial) set_contents(fallback);
				if (interval) clearInterval(interval);
			}
		}

		load(true);
		// watch the file on disk so saving in your editor live-reloads the playground
		interval = setInterval(() => load(false), 1000);
		return () => interval && clearInterval(interval);
	});
</script>

<main>
	<Repl bind:this={repl} />
</main>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
	}

	main {
		height: 100vh;
	}
</style>
