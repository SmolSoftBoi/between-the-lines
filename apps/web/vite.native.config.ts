import react from "@vitejs/plugin-react";
// @ts-expect-error -- Vite runs this config in Node, but this workspace does not ship Node ambient types.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    target: "es2022",
    sourcemap: false,
    outDir: fileURLToPath(
      new URL("../apple/Sources/BetweenTheLinesApple/Resources/native-renderer", import.meta.url)
    ),
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL("native.html", import.meta.url))
    }
  }
});
