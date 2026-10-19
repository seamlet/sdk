import type { Fields, SiteDescription, SitePageDescription } from "./schema";
import type { SeamletSiteDefinition } from "./site";

// What a site tells the CMS about itself, from its definition: everything but how it renders.

export function describeSite<F extends Fields>(
  definition: SeamletSiteDefinition<F>,
): SiteDescription {
  const pages = Object.entries(definition.pages).map(
    ([path, page]): SitePageDescription => ({
      path,
      title: page.title,
      ...(page.searchTexts === undefined
        ? {}
        : { searchTexts: page.searchTexts }),
    }),
  );
  const [home, ...rest] = pages;
  if (home === undefined) {
    throw new Error(`The site "${definition.id}" has no pages`);
  }
  return {
    id: definition.id,
    title: definition.title,
    schema: definition.schema,
    initialContent: definition.initialContent,
    pages: [home, ...rest],
  };
}
