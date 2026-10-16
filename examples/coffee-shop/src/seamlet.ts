import { defineSeamletSite } from "@seamlet/astro/site";
import HomePage from "./components/HomePage.astro";
import MenuPage from "./components/MenuPage.astro";
import { coffeeShopSchema } from "./schema";

// The coffee shop as the CMS knows it: its address there, its schema and its pages. The CMS lists
// the same page addresses for its editor.
export default defineSeamletSite({
  id: "coffee-shop",
  schema: coffeeShopSchema,
  pages: { "/": HomePage, "/menu": MenuPage },
});
