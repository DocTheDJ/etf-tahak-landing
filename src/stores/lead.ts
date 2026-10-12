// "Has this visitor signed up?" Shared by every island through the one Pinia instance (src/vue-app.ts).
// When set: every form shows "Tahák už máte", the table unlocks, the sticky bar hides.
import { defineStore } from "pinia";
import { ref } from "vue";

const KEY = "lead";

export const useLeadStore = defineStore("lead", () => {
  /** Lead id from the API; persisted so returning visitors aren't asked again. */
  const leadId = ref<string | null>(null);
  /** Which form submitted during this page view: that one shows the full thank-you panel. */
  const submittedFrom = ref<string | null>(null);

  /**
   * Read the saved lead. Call it in onMounted, never at setup: the server renders the "not signed up" version,
   * and applying stored state only after mount keeps hydration consistent.
   */
  function restore() {
    if (leadId.value) return;
    try { leadId.value = localStorage.getItem(KEY); } catch {}
  }

  function markLead(id: string, loc: string) {
    try { localStorage.setItem(KEY, id); } catch {}
    submittedFrom.value = loc;
    leadId.value = id;
  }

  return { leadId, submittedFrom, restore, markLead };
});
