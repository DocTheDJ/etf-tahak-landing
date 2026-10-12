// Runs for every Vue island (astro.config.mjs → vue({ appEntrypoint })).
// Each island is its own Vue app, so they share state only through ONE Pinia instance: it's created once here
// (module scope = once per page in the browser) and installed into every island.
import type { App } from "vue";
import { createPinia } from "pinia";

const pinia = createPinia();

export default (app: App) => {
  app.use(pinia);
};
