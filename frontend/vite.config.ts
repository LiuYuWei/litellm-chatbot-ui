import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// 前端建置產物直接輸出到 backend/static，讓 FastAPI 能一併提供靜態檔案。
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../backend/static',
    emptyOutDir: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // 拆出較大的第三方套件，讓瀏覽器可以分別快取。
        manualChunks: {
          react: ['react', 'react-dom'],
          markdown: ['react-markdown', 'remark-gfm'],
          highlight: ['rehype-highlight', 'highlight.js'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      // 開發模式下把 API 請求代理到本機 FastAPI。
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
