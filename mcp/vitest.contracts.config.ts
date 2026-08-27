import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/contracts/**/*.test.ts"],
    exclude: ["dist/**"],
  },
});
