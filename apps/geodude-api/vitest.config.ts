import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "miniflare",
    environmentOptions: {
      bindings: {
        OPTIVIEW_DB: "test_db",
        AI_FINGERPRINTS: "test_kv"
      },
      kvNamespaces: ["AI_FINGERPRINTS"],
      d1Databases: ["OPTIVIEW_DB"]
    },
    setupFiles: ["./tests/setup.ts"]
  }
});
