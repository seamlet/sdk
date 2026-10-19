import { defineConfig } from "tsup";

// The schema language and the bridge are built here for both of their users: the sites, and the
// CMS, which takes them from npm. The virtual modules come from the site's build.
export default defineConfig({
  entry: {
    index: "src/index.ts",
    schema: "src/schema/index.ts",
    bridge: "src/bridge/index.ts",
    protocol: "src/protocol.ts",
    site: "src/site.ts",
    client: "src/client.ts",
    cli: "src/cli.ts",
    "preview-requests": "src/preview-requests.ts",
    "routes/media": "src/routes/media.ts",
    "routes/own-photos": "src/routes/own-photos.ts",
    "routes/site-description": "src/routes/site-description.ts",
  },
  format: "esm",
  target: "node24",
  // tsup sets baseUrl for the declarations, which TypeScript 6 warns about.
  dts: { compilerOptions: { ignoreDeprecations: "6.0" } },
  clean: true,
  external: ["astro", /^virtual:seamlet\//u],
});
