import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        releaseCenter: resolve(__dirname, "release_center.html"),
      },
    },
  },
  // 1. 先注释掉这行，避免破坏你原本的 img 标签路径
  // publicDir: "src/renderer/assets", 
  resolve: {
    alias: {
      // 2. 把 "react-src" 改成 "src"，让它指向我们刚写代码的地方
      "@": resolve(__dirname, "src") 
    }
  }
});
