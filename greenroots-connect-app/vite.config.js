import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  build: {
    // Keep the Firebase SDK in its own chunk so it caches separately from app code.
    rollupOptions: {
      output: {
        manualChunks: { firebase: ["firebase/app", "firebase/auth", "firebase/firestore"] },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
