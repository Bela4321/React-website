import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// The home page is a plain static page (public/index.html, drawn with the design kit in
// public/assets). Only the two project pages are React apps.
export default defineConfig({
  plugins: [react()],
  build: {
    assetsDir: "build", // public/assets holds the design kit
    rollupOptions: {
      input: {
        sudoku: resolve(__dirname, "sudoku/index.html"),
        tictactoe: resolve(__dirname, "tictactoe/index.html"),
      },
    },
  },
});
