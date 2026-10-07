import react from '@vitejs/plugin-react';
// import { federation } from "@module-federation/vite";
import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const base = env.VITE_BASE_URL ? `/${env.VITE_BASE_URL.replace(/^\/|\/$/g, '')}/` : '/';

  return {
    base,
    plugins: [
      tailwindcss(),
      react(),
      // federation({
      //   name: "hrHub",
      //   remotes: {
      //     lateHub: {
      //       name: "lateHub",
      //       entry: "http://localhost:5174/remoteEntry.js",
      //       type: "module",
      //     },
      //   },
      //   shared: ["react", "react-dom"],
      // }),
    ],
    resolve: {
      alias: {
        '@': `${import.meta.dirname}/src`,
      },
    },
    server: {
      port: 5170,
      strictPort: true,

      proxy: {
        '/hr-hub/api': {
          target: 'http://localhost:3003',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/hr-hub\/api/, ''),
        },
      },
    },
    // Explicit build output config for cache headers at deployment
    build: {
      outDir: 'dist',
      assetsDir: 'assets',

      rollupOptions: {
        output: {
          entryFileNames: 'assets/[hash].js',
          chunkFileNames: (chunkInfo) => {
            switch (chunkInfo.name) {
              case 'AppSwitcher':
                return 'assets/app.[hash].js';
              case 'HRHubPage':
                return 'assets/hr-hub.[hash].js';
              case 'LateHubPage':
                return 'assets/late-hub.[hash].js';
              default:
                break;
            }
            return 'assets/[name]-[hash].js';
          },
          assetFileNames: 'assets/[hash][extname]',

          // Vite 8 (Rolldown) dropped the object form of `manualChunks`; the
          // function form is the supported equivalent. Keep the long-lived
          // framework deps in a single `vendor` chunk for stable cache headers.
          manualChunks(id) {
            if (
              /[\\/]node_modules[\\/](react|react-dom|react-router|@tanstack[\\/]react-query)[\\/]/.test(
                id,
              )
            ) {
              return 'vendor';
            }
          },
        },
      },
    },
  };
});
