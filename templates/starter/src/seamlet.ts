import { defineSeamletSite } from "@seamlet/astro/site";
import HomePage from "./components/HomePage.astro";
import { initialContent, schema } from "./schema";

// The site as the CMS knows it: its schema, the content it starts with and its pages (its id and
// title are in seamlet.json). Every page is a component that takes the content as its prop.
export default defineSeamletSite({
  schema,
  initialContent,
  pages: {
    // `searchTexts` names where the content holds the page's title and description for search.
    "/": { title: "Главная", component: HomePage, searchTexts: "seo" },
  },
});
