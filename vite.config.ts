import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import mkcert from 'vite-plugin-mkcert'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    mkcert()
  ],
  server: {
    host: true, // This allows access from other devices on your network
    proxy: {
      '^/(api)': {
        target: process.env.VITE_PRODUCTION === 'true' ? 'https://api.porto.blainemalone.com' : 'http://localhost:8787',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (_proxyReq, req) => {
            console.log('Proxying request:', req.method, req.url)
          })
        }
      }
    }
    
  }
})