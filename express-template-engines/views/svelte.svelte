<script>
  // Values from Express Locals
  export let title;
  export let message;
  // Component data
  export let people = ['scott', 'wes'];
  // External component
  import Card from './components/Card.svelte';
</script>

<p>{title} - {message}</p>

{#each people as person}
  <p>{person}</p>
{/each}

<Card />
