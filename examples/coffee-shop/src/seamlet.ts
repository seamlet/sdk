import { defineSeamletSite } from "@seamlet/astro/site";
import DrinkPage from "./components/DrinkPage.astro";
import HomePage from "./components/HomePage.astro";
import MenuPage from "./components/MenuPage.astro";
import ConsentPage from "./components/ConsentPage.astro";
import PrivacyPage from "./components/PrivacyPage.astro";
import { tableForm } from "./forms";
import { coffeeShopInitialContent } from "./initial-content";
import { coffeeShopSchema, drinkPages } from "./schema";

// The coffee shop as the CMS knows it: its schema, the content it starts with, its pages, a page of
// every drink and the form of a table's booking (its id and name there are in seamlet.json). The CMS takes all of it from the site
// itself.
export default defineSeamletSite({
  schema: coffeeShopSchema,
  initialContent: coffeeShopInitialContent,
  pages: {
    "/": { title: "Главная", component: HomePage },
    "/menu": { title: "Меню", component: MenuPage },
    "/privacy": { title: "Политика данных", component: PrivacyPage },
    "/consent": {
      title: "Согласие на обработку данных",
      component: ConsentPage,
    },
  },
  recordPages: [{ pages: drinkPages, component: DrinkPage }],
  forms: [tableForm],
});
