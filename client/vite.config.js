import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    // Same-origin API in dev so httpOnly/CSRF cookies just work.
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  test: {
    // Keep tests independent of a developer's .env.local (the demo panel is opt-in).
    env: { VITE_DEMO_LOGIN: "false" },
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
  },
})
