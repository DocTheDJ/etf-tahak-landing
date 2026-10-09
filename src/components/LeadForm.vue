<script setup lang="ts">
// The one-field email form. Used in several places on the page (hero, after the calculator, final block);
// `loc` says which one, so we know which position converts.
//
// States:  form  →  (submit)  →  thank-you panel (only in the form that was submitted)
//          any other form on the page, or a returning visitor  →  "Tahák už máte ✓"
import { computed, onMounted, ref } from "vue";
import { useStore } from "@nanostores/vue";
import { config } from "@/config";
import { isEmail, suggestEmail } from "@/lib/email";
import { track, session } from "@/lib/tracking";
import { $leadId, $submittedFrom, markLead } from "@/stores/lead";
import { $calc } from "@/stores/calc";
import ThankYou from "./ThankYou.vue";

const props = withDefaults(defineProps<{ loc: string; label: string; button?: string }>(), {
  button: "Chci tahák →",
});

const leadId = useStore($leadId);
const submittedFrom = useStore($submittedFrom);

// The server renders the empty form; the stored lead state only applies after mount (avoids hydration mismatch).
const mounted = ref(false);
onMounted(() => (mounted.value = true));
const view = computed<"form" | "done" | "got-it">(() => {
  if (!mounted.value || !leadId.value) return "form";
  return submittedFrom.value === props.loc ? "done" : "got-it";
});

const email = ref("");
const honeypot = ref("");
const error = ref("");
const suggestion = ref<string | null>(null);
const sending = ref(false);
const emailed = ref(false);
let suggestedFor = "";

const formEl = ref<HTMLFormElement | null>(null);
onMounted(() => {
  if (!formEl.value || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { track("form_view", { loc: props.loc }, { once: `form_view:${props.loc}` }); io.disconnect(); }
  }, { threshold: 0.25 });
  io.observe(formEl.value);
});

function onFocus() {
  track("form_start", { loc: props.loc }, { once: "form_start" });
  track("form_focus", { loc: props.loc }, { once: `focus:${props.loc}` });
}

function fail(type: string, message: string) {
  error.value = message;
  track("form_error", { loc: props.loc, type });
}

function acceptSuggestion() {
  email.value = suggestion.value!;
  suggestion.value = null;
  error.value = "";
  track("typo_accepted", { loc: props.loc });
}

async function submit() {
  const value = email.value.trim().toLowerCase();
  error.value = "";
  suggestion.value = null;
  if (!value) return fail("empty", "Zadejte e-mail, ať máme kam tahák poslat.");
  if (!isEmail(value)) return fail("invalid", "Tohle nevypadá jako e-mail. Zkontrolujte prosím zavináč a doménu.");

  // Suggest a fix once; submitting again sends the address as typed.
  const fix = suggestEmail(value);
  if (fix && suggestedFor !== value) {
    suggestedFor = value;
    suggestion.value = fix;
    return track("form_error", { loc: props.loc, type: "typo_suggested" });
  }
  if (honeypot.value) return;

  sending.value = true;
  track("form_submit", { loc: props.loc });
  const s = session();
  try {
    const res = await fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: value, loc: props.loc, sid: s.sid, ctx: s.ctx, t: s.t, calc: $calc.get(), company: "" }),
    });
    const body = await res.json();
    if (!res.ok) throw body;
    email.value = value;
    emailed.value = body.emailed;
    track("lead_submitted", { loc: props.loc, time_to_lead_s: Math.round(s.t), loss: $calc.get().loss });
    markLead(body.id, props.loc);
  } catch (err) {
    const invalid = (err as { error?: string })?.error === "invalid_email";
    fail(invalid ? "invalid" : "server", invalid ? "Tenhle e-mail neumíme ověřit. Zkuste jiný." : "Něco se pokazilo na naší straně. Zkuste to prosím znovu.");
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <ThankYou v-if="view === 'done'" :email="email" :emailed="emailed" :lead-id="leadId!" />

  <p v-else-if="view === 'got-it'" class="got-it">
    Tahák už máte ✓
    <a :href="config.pdfUrl" download @click="track('pdf_download', { from: 'got_it' })">Stáhnout znovu</a>
  </p>

  <form v-else ref="formEl" class="lead" :data-loc="loc" novalidate @submit.prevent="submit">
    <label class="label" :for="`email-${loc}`">{{ label }}</label>
    <div class="row">
      <input
        :id="`email-${loc}`"
        v-model="email"
        class="input"
        name="email"
        type="email"
        inputmode="email"
        autocomplete="email"
        autocapitalize="off"
        spellcheck="false"
        enterkeyhint="send"
        placeholder="vas@email.cz"
        :aria-invalid="error || suggestion ? 'true' : undefined"
        @focus="onFocus"
        @input="error = ''"
      />
      <button class="btn btn--primary" type="submit" :disabled="sending">{{ sending ? "Odesílám…" : button }}</button>
    </div>
    <input v-model="honeypot" class="hp" name="company" tabindex="-1" autocomplete="off" aria-hidden="true" />
    <p v-if="suggestion" class="error" role="alert">
      Nemysleli jste <button type="button" @click="acceptSuggestion">{{ suggestion }}</button>? Pokud ne, odešlete znovu.
    </p>
    <p v-else-if="error" class="error" role="alert">{{ error }}</p>
    <p class="micro">PDF hned ke stažení. Žádné telefonáty, žádný poradce. <a href="/ochrana-udaju">Co s e-mailem uděláme</a></p>
  </form>
</template>

<style scoped>
.lead { margin: 4px 0 0; }
.label { display: block; font-weight: 700; font-size: 16px; line-height: 1.3; margin: 0 0 10px; }
.row { display: flex; gap: 8px; }
.input {
  -webkit-appearance: none; appearance: none; flex: 1; min-width: 0;
  min-height: 52px; padding: 0 14px; border: 1px solid var(--line); border-radius: var(--r);
  background: var(--surface); color: var(--text); font: 500 15px/1 var(--f-mono);
}
.input::placeholder { color: #6b7180; }
.input:focus { border-color: var(--lime); outline: none; }
.input[aria-invalid="true"] { border-color: var(--coral); box-shadow: 0 0 0 1px var(--coral); }
.row .btn { flex: none; }
.error { color: var(--coral); font-weight: 600; margin: 8px 0 0; font-size: 14px; }
.error button { font: inherit; color: var(--lime); background: none; border: 0; padding: 0; text-decoration: underline; cursor: pointer; font-weight: 700; }
.micro { font-size: 12.5px; color: var(--muted); margin: 8px 0 0; line-height: 1.4; }
.micro a { color: var(--muted); }
.hp { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }
.got-it { font-size: 15px; font-weight: 700; color: var(--lime); margin: 4px 0 0; }
.got-it a { color: var(--text); }
</style>
