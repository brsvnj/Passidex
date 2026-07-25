import { defineConfig } from "vitest/config";

export default defineConfig({
  // Source uses NodeNext ".js" specifiers; map them back to ".ts" for tests.
  resolve: { extensionAlias: { ".js": [".ts", ".js"] } },
});
