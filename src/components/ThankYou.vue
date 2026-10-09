<script setup lang="ts">
// Shown in place of the form that was just submitted: instant download (no waiting for the email),
// a separate opt-in for the tips emails (marketing consent, see lib/consent.ts), one optional profiling
// question, and a share loop.
import { onMounted, ref } from "vue";
import { config } from "@/config";
import { track } from "@/lib/tracking";
import { CURRENT_CONSENT } from "@/lib/consent";

const props = defineProps<{ email: string; emailed: boolean; leadId: string }>();

const ANSWERS = [
  { id: "lt2k", label: "do 2 000 Kč" },
  { id: "2-5k", label: "2–5 tisíc" },
  { id: "5-15k", label: "5–15 tisíc" },
  { id: "15k+", label: "15 tisíc +" },
];
const answered = ref(false);
const optin = ref<"open" | "yes" | "no" | "error">("open");
const copied = ref(false);

const panel = ref<HTMLElement | null>(null);
const shareUrl = ref("");
onMounted(() => {
  shareUrl.value = `${location.origin}${location.pathname}?utm_source=share&utm_medium=referral`;
  panel.value?.focus({ preventScroll: true });
  panel.value?.scrollIntoView({ behavior: "smooth", block: "start" });
  track("thank_you_view");
});

function answer(id: string) {
  answered.value = true;
  track("profile_answer", { answer: id });
  patchLead({ profile: { monthly: id } }).catch(() => {});
}

function patchLead(body: Record<string, unknown>) {
  return fetch("/api/lead", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: props.leadId, email: props.email, ...body }),
  });
}

async function giveConsent() {
  try {
    const res = await patchLead({ consent: { granted: true, version: CURRENT_CONSENT.version } });
    if (!res.ok) throw new Error(String(res.status));
    optin.value = "yes";
    track("optin_given", { version: CURRENT_CONSENT.version });
  } catch {
    optin.value = "error"; // no consent is recorded unless the server confirmed it
  }
}

function declineConsent() {
  optin.value = "no";
  track("optin_declined");
}

async function copyLink() {
  track("share", { channel: "copy" });
  try { await navigator.clipboard.writeText(shareUrl.value); copied.value = true; } catch {}
}

const whatsapp = () =>
  "https://wa.me/?text=" + encodeURIComponent("Tohle se ti bude hodit, americká ETF a čím je nahradit z Česka: " + shareUrl.value);
</script>

<template>
  <div ref="panel" class="done" tabindex="-1">
    <p class="kicker"><span class="live-dot"></span>HOTOVO</p>
    <p class="title">Tahák je váš.</p>
    <a class="btn btn--primary btn--block" :href="config.pdfUrl" download @click="track('pdf_download', { from: 'done' })">
      Stáhnout tahák (PDF, 2 strany)
    </a>
    <p class="note">
      <template v-if="emailed">Kopie míří na {{ email }}. Kdyby nedorazila, mrkněte do složky Hromadné nebo Spam.</template>
      <template v-else>Odkaz na tahák vám pošleme i na {{ email }}.</template>
    </p>
    <p class="note">Všechna dvojčata ve srovnání jsou teď odemčená. <a href="#srovnani">Ukázat</a></p>

    <div class="block optin" :class="{ 'optin--open': optin === 'open' || optin === 'error' }">
      <template v-if="optin === 'open' || optin === 'error'">
        <p class="q">Chcete k taháku i 4 krátké tipy e-mailem?</p>
        <p class="consent">{{ CURRENT_CONSENT.text }} <a href="/ochrana-udaju">Ochrana osobních údajů</a></p>
        <div class="optin__actions">
          <button type="button" class="btn btn--primary" @click="giveConsent">Ano, chci tipy</button>
          <button type="button" class="link" @click="declineConsent">Ne, stačí mi PDF</button>
        </div>
        <p v-if="optin === 'error'" class="err" role="alert">Souhlas se nepodařilo uložit. Zkuste to prosím znovu.</p>
      </template>
      <p v-else-if="optin === 'yes'" class="thanks">Díky! První tip dorazí do pár dní. Odhlásit se můžete v každém e-mailu.</p>
      <p v-else class="muted">Dobře, žádné další e-maily. Tahák už máte.</p>
    </div>

    <div class="block">
      <template v-if="!answered">
        <p class="q">Ještě jedna věc, nepovinně: kolik měsíčně chcete investovat?</p>
        <div class="chips">
          <button v-for="a in ANSWERS" :key="a.id" type="button" class="chip" @click="answer(a.id)">{{ a.label }}</button>
        </div>
      </template>
      <p v-else class="thanks">Díky! Pomůže nám to tahák vylepšovat.</p>
    </div>

    <div class="block share">
      <p class="q">Znáte někoho, kdo platí bance 2 % ročně?</p>
      <a class="btn btn--ghost" :href="whatsapp()" target="_blank" rel="noopener" @click="track('share', { channel: 'whatsapp' })">Poslat přes WhatsApp</a>
      <button type="button" class="btn btn--ghost" @click="copyLink">{{ copied ? "Zkopírováno ✓" : "Zkopírovat odkaz" }}</button>
    </div>
  </div>
</template>

<style scoped>
.done { background: var(--surface); border: 1px solid var(--lime); border-radius: var(--r-lg); padding: 18px 16px; outline: none; animation: rise 0.35s ease-out both; scroll-margin-top: 56px; /* clear the sticky ticker */ }
.kicker { display: flex; align-items: center; gap: 8px; font: 700 12px/1 var(--f-mono); letter-spacing: 0.08em; color: var(--lime); margin: 0; }
.title { font-weight: 800; font-size: 32px; letter-spacing: -0.03em; line-height: 1; margin: 8px 0 14px; }
.note { font-size: 14px; color: var(--text-2); margin: 10px 0 0; }
.note a { color: var(--lime); }
.block { margin-top: 18px; padding-top: 14px; border-top: 1px dashed var(--line); }
.q { font-weight: 700; margin: 0 0 10px; font-size: 15px; }
.thanks { font-weight: 700; color: var(--lime); margin: 0; }
.optin--open { background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--r); padding: 14px; margin-top: 16px; }
.consent { font-size: 13px; line-height: 1.45; color: var(--text-2); margin: 0 0 12px; }
.consent a { color: var(--lime); }
.optin__actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.optin__actions .btn { min-height: 46px; font-size: 15px; }
.muted { color: var(--muted); margin: 0; font-size: 14px; }
.err { color: var(--coral); font-weight: 600; font-size: 14px; margin: 10px 0 0; }
.share { display: flex; flex-wrap: wrap; gap: 8px; }
.share .q { width: 100%; margin-bottom: 4px; }
</style>
