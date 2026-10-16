import { defineConfig } from "tsup";
import { writeAssets } from "./scripts/assets";

// The tokens as values for code, and the stylesheets with the fonts beside them.
export default defineConfig({
  entry: { index: "src/index.ts" },
  format: "esm",
  target: "es2022",
  // tsup sets baseUrl for the declarations, which TypeScript 6 warns about.
  dts: { compilerOptions: { ignoreDeprecations: "6.0" } },
  clean: true,
  onSuccess: () => writeAssets("dist"),
});
