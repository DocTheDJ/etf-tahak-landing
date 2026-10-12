<script setup lang="ts">
// A pill toggle (calculator amounts/years, table filters, profiling answers). `on` = selected.
//   fill: chips share the row width equally (calculator)   font: "mono" for numbers, "sans" for words
import { computed } from "vue";

const props = withDefaults(defineProps<{ on?: boolean; fill?: boolean; font?: "mono" | "sans" }>(), {
  on: false,
  fill: false,
  font: "mono",
});

const classes = computed(() => [
  "min-h-[44px] border rounded-[12px] leading-none cursor-pointer appearance-none",
  "transition-[background-color,border-color,color] duration-150",
  props.font === "mono" ? "font-mono font-bold text-[13px]" : "font-sans font-bold text-[14px]",
  props.fill ? "flex-1 px-1.5" : "flex-none px-3",
  props.on ? "bg-lime border-lime text-ink" : "bg-transparent border-line text-fg hover:border-lime",
]);
</script>

<template>
  <button type="button" :class="classes" :aria-pressed="on"><slot /></button>
</template>
