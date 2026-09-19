import react from "@vitejs/plugin-react";
// import { federation } from "@module-federation/vite";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
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
      "@": `${import.meta.dirname}/src`,
    },
  },
  server: {
    port: 5170,
    strictPort: true,

    proxy: {
      "/api": {
        target: "http://localhost:3003",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
