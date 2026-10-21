import { defineSeamletSite } from "@seamlet/astro/site";
import DrinkPage from "./components/DrinkPage.astro";
import HomePage from "./components/HomePage.astro";
import MenuPage from "./components/MenuPage.astro";
import { coffeeShopInitialContent } from "./initial-content";
import { coffeeShopSchema, drinkPages } from "./schema";

// The coffee shop as the CMS knows it: its schema, the content it starts with, its pages and a page
// of every drink (its id and name there are in seamlet.json). The CMS takes all of it from the site
// itself.
export default defineSeamletSite({
  schema: coffeeShopSchema,
  initialContent: coffeeShopInitialContent,
  pages: {
    "/": { title: "Главная", component: HomePage },
    "/menu": { title: "Меню", component: MenuPage },
  },
  recordPages: [{ pages: drinkPages, component: DrinkPage }],
});
