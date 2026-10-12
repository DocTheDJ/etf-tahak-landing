<script setup lang="ts">
// The one-field email form. Used in several places on the page (hero, after the calculator, final block);
// `loc` says which one, so we know which position converts.
//
// States:  form  →  (submit)  →  thank-you panel (only in the form that was submitted)
//          any other form on the page, or a returning visitor  →  "Tahák už máte ✓"
import { computed, onMounted, ref } from "vue";
import { storeToRefs } from "pinia";
import { config } from "@/config";
import { isEmail, suggestEmail } from "@/lib/email";
import { track, session } from "@/lib/tracking";
import { useLeadStore } from "@/stores/lead";
import { useCalculatorStore } from "@/stores/calculator";
import ThankYou from "./ThankYou.vue";
import Btn from "./ui/Btn.vue";

const props = withDefaults(defineProps<{ loc: string; label: string; button?: string }>(), {
  button: "Chci tahák →",
});

const lead = useLeadStore();
const calc = useCalculatorStore();
const { leadId, submittedFrom } = storeToRefs(lead);

// The server renders the empty form; the stored lead state only applies after mount (avoids hydration mismatch).
const mounted = ref(false);
onMounted(() => { lead.restore(); mounted.value = true; });
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

// Attention effects (design canvas "Email & unlock glow"): while the address isn't valid yet, a lime light runs
// around the field. Once it is, the field turns solid lime with a ✓ and a light sweep passes over the button.
const valid = computed(() => isEmail(email.value.trim()));
const fieldState = computed(() => (error.value || suggestion.value ? "err" : valid.value ? "ok" : "run"));
const buttonText = computed(() => props.button.replace(/\s*→$/, ""));
const buttonArrow = computed(() => /→$/.test(props.button));

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
      body: JSON.stringify({ email: value, loc: props.loc, sid: s.sid, ctx: s.ctx, t: s.t, calc: calc.snapshot(), company: "" }),
    });
    const body = await res.json();
    if (!res.ok) throw body;
    email.value = value;
    emailed.value = body.emailed;
    track("lead_submitted", { loc: props.loc, time_to_lead_s: Math.round(s.t), loss: calc.loss });
    lead.markLead(body.id, props.loc);
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

  <p v-else-if="view === 'got-it'" class="mt-1 text-[15px] font-bold text-lime">
    Tahák už máte ✓
    <a :href="config.pdfUrl" download class="text-fg" @click="track('pdf_download', { from: 'got_it' })">Stáhnout znovu</a>
  </p>

  <form v-else ref="formEl" class="mt-1" :data-loc="loc" novalidate @submit.prevent="submit">
    <label class="mb-2.5 block text-[16px] leading-[1.3] font-bold" :for="`email-${loc}`">{{ label }}</label>
    <div class="flex gap-2">
      <!-- the field's 2px padding is its border: running light (run), lime (ok) or coral (err) -->
      <div
        class="relative isolate flex min-w-0 flex-1 items-center overflow-hidden rounded-ctl p-0.5 transition-colors duration-200"
        :class="{ run: 'comet-border', ok: 'bg-lime', err: 'bg-coral' }[fieldState]"
        :data-state="fieldState"
      >
        <input
          :id="`email-${loc}`"
          v-model="email"
          class="min-h-[50px] w-full min-w-0 flex-1 appearance-none rounded-[12px] border-0 bg-surface pl-3.5 font-mono text-[15px] leading-none font-medium text-fg outline-none placeholder:text-placeholder"
          :class="fieldState === 'ok' ? 'pr-[42px]' : 'pr-3.5'"
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
        <span
          v-if="fieldState === 'ok'"
          class="absolute right-[13px] flex size-[22px] animate-pop items-center justify-center rounded-full bg-lime text-ink"
          aria-hidden="true"
          data-testid="email-check"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L19 7" /></svg>
        </span>
      </div>
      <Btn
        variant="primary"
        type="submit"
        class="flex-none"
        :class="valid && !sending && 'sheen shadow-[0_0_24px_rgba(212,255,58,0.3)]'"
        :disabled="sending"
      >
        <template v-if="sending">Odesílám…</template>
        <template v-else>{{ buttonText }}<template v-if="buttonArrow">&#32;<span :class="valid && 'inline-block animate-nudge'">→</span></template></template>
      </Btn>
    </div>
    <input v-model="honeypot" class="absolute -left-[9999px] size-px opacity-0" name="company" tabindex="-1" autocomplete="off" aria-hidden="true" />
    <p v-if="suggestion" class="mt-2 text-[14px] font-semibold text-coral" role="alert">
      Nemysleli jste <button type="button" class="cursor-pointer font-bold text-lime underline" @click="acceptSuggestion">{{ suggestion }}</button>? Pokud ne, odešlete znovu.
    </p>
    <p v-else-if="error" class="mt-2 text-[14px] font-semibold text-coral" role="alert">{{ error }}</p>
    <p class="mt-2 text-[12.5px] leading-[1.4] text-muted [&_a]:text-muted">PDF hned ke stažení. Žádné telefonáty, žádný poradce. <a href="/ochrana-udaju">Co s e-mailem uděláme</a></p>
  </form>
</template>
