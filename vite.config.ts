import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,          // 0.0.0.0 바인딩 → 같은 네트워크의 다른 PC 접근 허용
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'ws://localhost:3001',
        changeOrigin: true,
        ws: true,          // WebSocket 프록시
      },
    },
  },
})
