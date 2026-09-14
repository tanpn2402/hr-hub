import react from "@vitejs/plugin-react";
import { federation } from "@module-federation/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "hrHub",
      remotes: {
        lateHub: {
          name: "lateHub",
          entry: "http://localhost:5174/remoteEntry.js",
          type: "module",
        },
      },
      shared: ["react", "react-dom"],
    }),
  ],
  server: {
    port: 5170,
    strictPort: true,

    proxy: {
      "/api/late-hub": {
        target: "http://localhost:3003",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/late-hub/, ""),
      },
    },
  },
});
