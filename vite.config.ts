import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

import { firebaseMessagingSwPlugin } from './scripts/firebase-messaging-sw-plugin.js'
import { supplierOcrAssetsPlugin } from './scripts/supplier-ocr-assets-plugin.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss(), firebaseMessagingSwPlugin(env), supplierOcrAssetsPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
