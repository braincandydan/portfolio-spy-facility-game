import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        main: 'index.html',
        resume: 'resume.html',
      },
    },
  },
});
