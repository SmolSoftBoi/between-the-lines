import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    target: "es2022",
    sourcemap: false,
    outDir: "dist-native",
    emptyOutDir: true,
    rollupOptions: {
      input: new URL("native.html", import.meta.url).pathname
    }
  }
});
