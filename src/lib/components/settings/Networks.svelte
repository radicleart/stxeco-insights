<script lang="ts">
	import { onMount } from 'svelte';
	import { Icon, InformationCircle } from "svelte-hero-icons"
	import { Button } from 'flowbite-svelte'
	import { CONFIG, setConfig } from '$lib/config';
	import { sbtcConfig } from '$stores/stores';
	import type { SbtcConfig } from '$types/sbtc_config';
	import { fetchSbtcBalance } from '$lib/stacks_connect'
	import Banner from '$lib/ui/Banner.svelte';

	let mode = import.meta.env.MODE
    //if (!mode) mode = 'testnet'

	const switchDevnet = async () => {
		setConfig('devnet');
		await fetchSbtcBalance($sbtcConfig, true);
		sbtcConfig.update((conf:SbtcConfig) => {
			return conf;
		});
		const url = new URL(location.href);
		if (mode === 'simnet') {
			url.searchParams.set('chain', 'testnet');
		} else {
			url.searchParams.set('chain', 'devnet');
		}
		location.assign(url.search);
	}

	const switchDevenv = async () => {
		setConfig('devenv');
		await fetchSbtcBalance($sbtcConfig, true);
		sbtcConfig.update((conf:SbtcConfig) => {
			return conf;
		});
		const url = new URL(location.href);
		url.searchParams.set('chain', 'devenv');
		location.assign(url.search);
	}

	const toggleNetwork = async () => {
		let net = CONFIG.VITE_NETWORK;
		if (net === 'mainnet') net = 'testnet';
		else net = 'mainnet'
		setConfig(net);
		await fetchSbtcBalance($sbtcConfig, true);
		sbtcConfig.update((conf:SbtcConfig) => {
			return conf;
		});
		const url = new URL(location.href);
		if (mode === 'simnet') {
			url.searchParams.set('chain', 'testnet');
		} else {
			url.searchParams.set('chain', net);
		}
		location.assign(url.search);
	}

  onMount(async () => {
  })
</script>

<h2 class="text-2xl mb-2">Network</h2>
<div class="flex gap-2 mb-2 items-center">
  <p class="text-base text-white">
    You are currently on:
  </p>
  <p class="text-white">
		<span class="inline-flex bg-black rounded-xl text-white px-4 py-1">
      {CONFIG.VITE_ENVIRONMENT}
    </span>
  </p>
  <div id="po-network">
		<Icon src="{InformationCircle}" class="text-white w-6 h-6" mini aria-hidden="true" />
  </div>
</div>

{#if CONFIG.VITE_NETWORK === "testnet"}
	<Banner
		bannerType={'info'}
		message={'Don\'t have testnet Bitcoin? <a class="underline" href="https://bitcoinfaucet.uo1.net/" target="_blank">Get some to get started!</a>'}
	/>
{/if}

<div class="mt-4">
	<!--
	<Button on:click={() => toggleNetwork()} class="block w-full md:w-auto md:inline-flex items-center gap-x-1.5 bg-primary-01 px-4 py-2  text-black rounded-lg border border-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500/50 shrink-0">
		Switch network
	</Button>
	-->
	{#if mode === 'development'}
	<div class="mt-4">
	<Button on:click={() => switchDevnet()} class="text-center focus:ring-4 focus:outline-none items-center px-5 py-2.5 text-sm text-white focus:ring-primary-300 dark:focus:ring-primary-800 rounded-lg !bg-black !border-[0.5px] !border-gray-700">
		Switch to devnet
	</Button>
	<Button on:click={() => switchDevenv()} class="text-center focus:ring-4 focus:outline-none items-center px-5 py-2.5 text-sm text-white focus:ring-primary-300 dark:focus:ring-primary-800 rounded-lg !bg-black !border-[0.5px] !border-gray-700">
		Switch to devenv (shared devnet)
	</Button>
	</div>
	{/if}
  </div>


