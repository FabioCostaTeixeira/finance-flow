import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          globals: true,
          setupFiles: "./src/test/setup.ts",
          exclude: ["**/node_modules/**", "src/test/rls/**", "mcp/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "rls",
          environment: "node",
          globals: true,
          include: ["src/test/rls/**/*.test.ts"],
          setupFiles: "./src/test/rls/env.ts",
          testTimeout: 30000,
          // Os testes compartilham um Postgres real: rodar arquivos em paralelo
          // faria um cleanup derrubar o cenário de outro.
          fileParallelism: false,
          maxWorkers: 1,
        },
      },
    ],
  },
}));

