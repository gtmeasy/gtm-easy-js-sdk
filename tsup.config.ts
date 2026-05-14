import { defineConfig } from "tsup"

export default defineConfig({
  entry: {
    "core/index": "src/core/index.ts",
    "web/index": "src/web/index.ts",
    "node/index": "src/node/index.ts",
    "react-native/index": "src/react-native/index.ts",
    "bridges/index": "src/bridges/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  target: "es2020",
  treeshake: true,
})
