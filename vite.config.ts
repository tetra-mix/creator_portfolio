import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  // Set base path for GitHub Pages project site
  // Repo: creator_portfolio -> https://<user>.github.io/creator_portfolio/
  base: '/creator_portfolio/',
  plugins: [react()],
})
