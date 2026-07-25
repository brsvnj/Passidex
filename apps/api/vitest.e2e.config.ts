import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// E2e boots the real Nest app, so we need SWC to emit decorator metadata for DI.
export default defineConfig({
  test: {
    include: ["test/**/*.e2e-spec.ts"],
    globalSetup: ["test/global-setup.ts"],
    // Serial: all e2e files share one database.
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
    env: { DISABLE_SCHEDULER: "true" },
  },
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: "typescript", decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: "es2022",
      },
      module: { type: "es6" },
    }),
  ],
});
