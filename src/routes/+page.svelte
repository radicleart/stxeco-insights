<script lang="ts">
	import StackingMenu from "$lib/components/dashboard/common/StackingMenu.svelte";
	import StackingHighlights from "$lib/components/dashboard/insights/StackingHighlights.svelte";
	import { onMount } from "svelte";


	onMount(async () => {
  	})
</script>

<svelte:head>
	<title>Ecosystem DAO - Nakamoto Insights</title>
	<meta name="description" content="Governance of the Stacks Blockchain, Smart Contracts on Bitcoin" />
</svelte:head>

<div class="py-6 rounded-2xl sm:rounded-none">
	<div class="py-4 mx-auto max-w-7xl md:px-6">
		<StackingMenu method={1}/>
		<StackingHighlights />
		<!--<StackingFeatureChoice />-->
	</div>
</div>
