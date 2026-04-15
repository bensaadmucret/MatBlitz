import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],

})

// Ensure .wasm files are served with correct MIME type
// (Vite dev server sometimes misses this for files in public/)
