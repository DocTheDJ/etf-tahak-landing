<script setup lang="ts">
// The site's button. Renders an <a> when `href` is given, otherwise a <button>.
//   <Btn variant="primary" block>…</Btn>   <Btn href="#srovnani" variant="primary">…</Btn>
// Variations are props, not extra classes: conflicting Tailwind utilities on one element don't override by order.
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    variant?: "default" | "primary" | "ghost";
    /** md = 52px (main actions), sm = 46px (secondary). Ghost buttons are sm unless set. */
    size?: "md" | "sm";
    block?: boolean;
    href?: string;
    type?: "button" | "submit";
  }>(),
  { variant: "default", block: false, type: "button" },
);

const VARIANT = {
  default: "border-line bg-surface text-fg",
  primary: "border-lime bg-lime text-ink hover:border-white hover:bg-white",
  ghost: "border-line bg-surface text-fg hover:border-lime",
};
const SIZE = { md: "min-h-[52px] text-[16px]", sm: "min-h-[46px] text-[15px]" };

const classes = computed(() => [
  "inline-flex items-center justify-center gap-2 px-[18px] border rounded-ctl",
  "font-sans font-extrabold leading-[1.1] no-underline cursor-pointer appearance-none",
  "transition-[background-color,transform] duration-150 active:scale-[0.98]",
  "disabled:opacity-60 disabled:cursor-progress",
  VARIANT[props.variant],
  SIZE[props.size ?? (props.variant === "ghost" ? "sm" : "md")],
  props.block && "w-full",
]);
</script>

<template>
  <a v-if="href" :href="href" :class="classes"><slot /></a>
  <button v-else :type="type" :class="classes"><slot /></button>
</template>
