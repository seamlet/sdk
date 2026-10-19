// Plain TypeScript does not read `.astro` files: the tests that render the package's components
// import them as Astro's component factories, and Astro's compiler gives them their exact types.
declare module "*.astro" {
  const component: import("astro/runtime/server/index.js").AstroComponentFactory;
  export default component;
}
