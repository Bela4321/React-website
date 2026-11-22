import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Every page is a plain HTML file; <!-- @header --> and <!-- @footer --> pull in the
// shared parts from partials/, so each page carries the same header and footer.
function partials(): Plugin {
  return {
    name: "partials",
    // "pre": the parts are in the page before Vite bundles its links and scripts
    transformIndexHtml: { order: "pre", handler(html) {
      // partials may hold partials, so expand twice
      for (let i = 0; i < 2; i++) {
        html = html.replace(/<!-- @(\w+) -->/g, (_, name) =>
          readFileSync(resolve(__dirname, "partials", `${name}.html`), "utf8"),
        );
      }
      return html;
    } },
  };
}

// The pages: index.html, 404.html and every <folder>/index.html listed here.
const pages = ["sudoku", "tictactoe", "privacy", "credits"];
const input: Record<string, string> = {
  home: resolve(__dirname, "index.html"),
  notfound: resolve(__dirname, "404.html"),
};
for (const p of pages) input[p] = resolve(__dirname, p, "index.html");

export default defineConfig({
  plugins: [partials(), react(), tailwindcss()],
  build: { rollupOptions: { input } },
});
