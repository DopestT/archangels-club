import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

const commitHash = (() => {
  // Vercel injects this automatically during CI builds
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  }
  try { return execSync('git rev-parse --short HEAD').toString().trim(); }
  catch { return 'local'; }
})();
const buildTime = new Date().toISOString();

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  define: {
    __BUILD_SHA__: JSON.stringify(commitHash),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
