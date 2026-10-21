import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import { existsSync } from "node:fs";

const envFile = new URL("./.env", import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);

export default defineConfig({
  site: process.env.SITE_URL,
  base: process.env.BASE_PATH ?? "/",
  integrations: [tailwind()],
});
