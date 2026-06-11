import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    // The built SPA is served from the API origin in production; in dev we
    // proxy /api to the separately-running backend so the api layer can use
    // origin-relative URLs everywhere.
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
