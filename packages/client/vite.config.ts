import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  root: ".",
  publicDir: "public",
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  server: {
    port: 5173,
  },
  resolve: {
    alias: {
      shared: path.resolve(__dirname, "../shared/src"),
    },
  },
  define: {
    "process.env": {},
  },
});
