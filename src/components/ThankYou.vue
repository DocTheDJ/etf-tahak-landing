<script setup lang="ts">
// Shown in place of the form that was just submitted: instant download (no waiting for the email),
// a separate opt-in for the tips emails (marketing consent, see lib/consent.ts), one optional profiling
// question, and a share loop.
import { onMounted, ref } from "vue";
import { config } from "@/config";
import { track } from "@/lib/tracking";
import { CURRENT_CONSENT } from "@/lib/consent";
import Btn from "./ui/Btn.vue";
import Chip from "./ui/Chip.vue";

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
  <!-- scroll-mt clears the sticky ticker when the panel scrolls into view -->
  <div
    ref="panel"
    class="scroll-mt-14 animate-rise rounded-card border border-lime bg-surface px-4 py-[18px] outline-none"
    tabindex="-1"
    data-testid="thank-you"
  >
    <p class="flex items-center gap-2 font-mono text-[12px] leading-none font-bold tracking-[0.08em] text-lime"><span class="live-dot"></span>HOTOVO</p>
    <p class="mt-2 mb-3.5 text-[32px] leading-none font-extrabold tracking-[-0.03em]">Tahák je váš.</p>
    <Btn :href="config.pdfUrl" variant="primary" block download @click="track('pdf_download', { from: 'done' })">
      Stáhnout tahák (PDF, 2 strany)
    </Btn>
    <p class="mt-2.5 text-[14px] text-fg-2">
      <template v-if="emailed">Kopie míří na {{ email }}. Kdyby nedorazila, mrkněte do složky Hromadné nebo Spam.</template>
      <template v-else>Odkaz na tahák vám pošleme i na {{ email }}.</template>
    </p>
    <p class="mt-2.5 text-[14px] text-fg-2 [&_a]:text-lime">Všechna dvojčata ve srovnání jsou teď odemčená. <a href="#srovnani">Ukázat</a></p>

    <!-- marketing consent: its own boxed block while the question is open -->
    <div
      v-if="optin === 'open' || optin === 'error'"
      class="mt-4 rounded-ctl border border-line bg-surface-2 p-3.5"
    >
      <p class="mb-2.5 text-[15px] font-bold">Chcete k taháku i 4 krátké tipy e-mailem?</p>
      <p class="mb-3 text-[13px] leading-[1.45] text-fg-2 [&_a]:text-lime">{{ CURRENT_CONSENT.text }} <a href="/ochrana-udaju">Ochrana osobních údajů</a></p>
      <div class="flex flex-wrap items-center gap-3.5">
        <Btn variant="primary" size="sm" @click="giveConsent">Ano, chci tipy</Btn>
        <button type="button" class="cursor-pointer px-0.5 py-1 text-muted underline underline-offset-3" @click="declineConsent">Ne, stačí mi PDF</button>
      </div>
      <p v-if="optin === 'error'" class="mt-2.5 text-[14px] font-semibold text-coral" role="alert">Souhlas se nepodařilo uložit. Zkuste to prosím znovu.</p>
    </div>
    <div v-else class="mt-[18px] border-t border-dashed border-line pt-3.5">
      <p v-if="optin === 'yes'" class="font-bold text-lime">Díky! První tip dorazí do pár dní. Odhlásit se můžete v každém e-mailu.</p>
      <p v-else class="text-[14px] text-muted">Dobře, žádné další e-maily. Tahák už máte.</p>
    </div>

    <div class="mt-[18px] border-t border-dashed border-line pt-3.5">
      <template v-if="!answered">
        <p class="mb-2.5 text-[15px] font-bold">Ještě jedna věc, nepovinně: kolik měsíčně chcete investovat?</p>
        <div class="flex flex-wrap gap-1.5">
          <Chip v-for="a in ANSWERS" :key="a.id" @click="answer(a.id)">{{ a.label }}</Chip>
        </div>
      </template>
      <p v-else class="font-bold text-lime">Díky! Pomůže nám to tahák vylepšovat.</p>
    </div>

    <div class="mt-[18px] flex flex-wrap gap-2 border-t border-dashed border-line pt-3.5">
      <p class="mb-1 w-full text-[15px] font-bold">Znáte někoho, kdo platí bance 2 % ročně?</p>
      <Btn :href="whatsapp()" variant="ghost" target="_blank" rel="noopener" @click="track('share', { channel: 'whatsapp' })">Poslat přes WhatsApp</Btn>
      <Btn variant="ghost" @click="copyLink">{{ copied ? "Zkopírováno ✓" : "Zkopírovat odkaz" }}</Btn>
    </div>
  </div>
</template>
