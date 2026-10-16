// Astro types `.astro` imports through its own language tools (`astro check`). Plain TypeScript,
// which ESLint uses, does not read .astro files, so for it a component is a component factory.
declare module "*.astro" {
  const Component: import("astro/runtime/server/index.js").AstroComponentFactory;
  export default Component;
}
