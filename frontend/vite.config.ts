import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const FLASK = 'http://localhost:13371';

export default defineConfig({
  root: '.',
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'js',
  },
  resolve: {
    alias: { '@': '/src' },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/assets':           { target: FLASK, changeOrigin: true },
      '/manifest.json':    { target: FLASK, changeOrigin: true },
      '/today-tasks':      { target: FLASK, changeOrigin: true },
      '/complete-task':    { target: FLASK, changeOrigin: true },
      '/undo-complete-task': { target: FLASK, changeOrigin: true },
      '/add-task':         { target: FLASK, changeOrigin: true },
      '/add-today-task':   { target: FLASK, changeOrigin: true },
      '/next-tasks':       { target: FLASK, changeOrigin: true },
      '/upcoming-tasks':   { target: FLASK, changeOrigin: true },
      '/task':             { target: FLASK, changeOrigin: true },
      '/inbox-items':      { target: FLASK, changeOrigin: true },
      '/inbox':            { target: FLASK, changeOrigin: true },
      '/habits':           { target: FLASK, changeOrigin: true },
      '/complete-habit':   { target: FLASK, changeOrigin: true },
      '/uncomplete-habit': { target: FLASK, changeOrigin: true },
      '/music':            { target: FLASK, changeOrigin: true },
      '/workout':          { target: FLASK, changeOrigin: true },
      '/food':             { target: FLASK, changeOrigin: true },
      '/finance':          { target: FLASK, changeOrigin: true },
      '/vault-files':      { target: FLASK, changeOrigin: true },
      '/vault-tags':       { target: FLASK, changeOrigin: true },
      '/daily-note-uri':   { target: FLASK, changeOrigin: true },
      '/item':             { target: FLASK, changeOrigin: true },
    },
  },
});
