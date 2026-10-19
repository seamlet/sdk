import { defineSeamletSite } from "@seamlet/astro/site";
import HomePage from "./components/HomePage.astro";
import MenuPage from "./components/MenuPage.astro";
import { coffeeShopInitialContent } from "./initial-content";
import { coffeeShopSchema } from "./schema";

// The coffee shop as the CMS knows it: its address and name there, its schema, the content it
// starts with and its pages. The CMS takes all of it from the site itself.
export default defineSeamletSite({
  id: "coffee-shop",
  title: "Кофейня «Зерно»",
  schema: coffeeShopSchema,
  initialContent: coffeeShopInitialContent,
  pages: {
    "/": { title: "Главная", component: HomePage },
    "/menu": { title: "Меню", component: MenuPage },
  },
});
