import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  publicDir: "src/renderer/assets",
  resolve: {
    alias: {
      "@": resolve(__dirname, "react-src")
    }
  }
});
