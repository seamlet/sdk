import { describe, expect, it } from "vitest";
import { richTextOf } from "../schema";
import {
  avitoFeedOf,
  productOffersOf,
  yandexFeedOf,
  type FeedOffer,
  type ProductRecord,
} from "./index";

const SITE = "https://lesnaya.example";

function product(change: Partial<ProductRecord> = {}): ProductRecord {
  return {
    id: "p-1",
    name: "Баня из бруса 6×4",
    slug: "banya-6x4",
    photos: [{ photo: { src: "/media/lesnaya/a.webp", alt: "Баня" } }],
    summary: richTextOf("Готова за 30 дней"),
    description: richTextOf("Брус 150×150 & печь «Жар»."),
    price: 450000,
    priceNote: "",
    characteristics: [],
    isHidden: false,
    seo: { title: "", description: "", image: null },
    ...change,
  };
}

const offer: FeedOffer = {
  id: "p-1",
  name: "Баня из бруса 6×4",
  url: `${SITE}/catalog/banya-6x4`,
  price: 450000,
  description: "Брус 150×150 & печь «Жар».",
  pictures: [`${SITE}/media/lesnaya/a.webp`],
};

describe("productOffersOf", () => {
  it("tells a product as a feed does, with whole addresses", () => {
    const offers = productOffersOf([product()], {
      siteUrl: SITE,
      pathOf: (record) => `/catalog/${record.slug}`,
    });

    expect(offers).toEqual([offer]);
  });

  it("leaves out hidden products, and takes the short line for a missing description", () => {
    const offers = productOffersOf(
      [product({ isHidden: true }), product({ id: "p-2", description: [] })],
      { siteUrl: SITE, catalogPath: "/catalog" },
    );

    expect(
      offers.map(({ id, url, description }) => [id, url, description]),
    ).toEqual([["p-2", `${SITE}/catalog`, "Готова за 30 дней"]]);
  });
});

describe("yandexFeedOf", () => {
  const shop = {
    name: "Лесная мастерская",
    company: "ООО «Лесная мастерская»",
    url: SITE,
  };

  it("writes the offers with prices in YML, the words escaped", () => {
    const feed = yandexFeedOf(
      shop,
      [offer, { ...offer, id: "p-2", price: null }],
      new Date("2026-10-21T21:00:00.123Z"),
    );

    expect(feed).toContain('<yml_catalog date="2026-10-21T21:00:00Z">');
    expect(feed).toContain('<category id="1">Лесная мастерская</category>');
    expect(feed).toContain('<offer id="p1" available="true">');
    expect(feed).toContain("<price>450000</price><currencyId>RUB</currencyId>");
    expect(feed).toContain(
      "<description>Брус 150×150 &amp; печь «Жар».</description>",
    );
    expect(feed.match(/<offer /gu)).toHaveLength(1);
  });

  it("numbers the categories the offers name", () => {
    const feed = yandexFeedOf(
      shop,
      [
        { ...offer, category: "Бани" },
        { ...offer, id: "p-2", category: "Беседки" },
      ],
      new Date(0),
    );

    expect(feed).toContain(
      '<category id="1">Бани</category><category id="2">Беседки</category>',
    );
    expect(feed).toContain("<categoryId>2</categoryId>");
  });
});

describe("the words of a feed", () => {
  it("drop the characters XML has no place for", () => {
    const feed = yandexFeedOf(
      { name: "Лес\u0007", company: "ООО", url: SITE },
      [],
      new Date(0),
    );

    expect(feed).toContain("<name>Лес</name>");
  });
});

describe("avitoFeedOf", () => {
  const seller = {
    address: "Киров, ул. Лесная, 1",
    contactPhone: "+7 912 000-00-00",
    category: "Ремонт и строительство",
  };

  it("writes an ad of every product with a price, with the fields its category asks", () => {
    const feed = avitoFeedOf(seller, [offer], () => ({
      GoodsType: "Готовые строения",
    }));

    expect(feed).toContain('<Ads formatVersion="3" target="Avito.ru">');
    expect(feed).toContain("<Id>p-1</Id>");
    expect(feed).toContain("<Category>Ремонт и строительство</Category>");
    expect(feed).toContain(
      `<Images><Image url="${SITE}/media/lesnaya/a.webp"/></Images>`,
    );
    expect(feed).toContain("<GoodsType>Готовые строения</GoodsType>");
  });

  it("cuts a long name at a word to fit Avito's title", () => {
    const name =
      "Баня из профилированного бруса 6×4 с террасой, печью и комнатой отдыха";

    const feed = avitoFeedOf(seller, [{ ...offer, name }]);

    expect(feed).toContain(
      "<Title>Баня из профилированного бруса 6×4 с террасой,</Title>",
    );
  });
});
