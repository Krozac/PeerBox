import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.{js,ts,mjs}", "test/**/*.test.{js,ts,mjs}"],
    environment: "jsdom",
    coverage: {
      provider: "c8",
      reporter: ["text", "lcov"],
    },
  },
});