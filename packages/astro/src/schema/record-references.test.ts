import { describe, expect, expectTypeOf, it } from "vitest";
import {
  collection,
  collectionAt,
  defineSchema,
  editable,
  findRecord,
  group,
  newRecord,
  parseContent,
  reference,
  references,
  text,
  toggle,
  withRecordIds,
  type ContentOf,
  type ContentPath,
} from "./index";

const schema = defineSchema({
  studio: group({
    label: "Студия",
    fields: {
      teachers: collection({
        label: "Преподаватели",
        itemTitle: "name",
        item: { name: text({ label: "Имя" }) },
      }),
    },
  }),
  practices: collection({
    label: "Практики",
    itemTitle: "name",
    item: {
      name: text({ label: "Название" }),
      teacher: reference({ label: "Ведёт", collection: "studio.teachers" }),
      isHidden: toggle({ label: "Скрыть с сайта" }),
    },
  }),
  featured: references({ label: "На главной", collection: "practices" }),
});

const content = {
  studio: {
    teachers: [
      { id: "oksana", name: "Оксана" },
      { id: "elena", name: "Елена" },
    ],
  },
  practices: [
    { id: "yin", name: "Инь-йога", teacher: "oksana", isHidden: false },
    { id: "qigong", name: "Цигун", teacher: "elena", isHidden: false },
  ],
  featured: ["qigong"],
};

function counter(): () => string {
  let count = 0;
  return () => {
    count += 1;
    return `new-${String(count)}`;
  };
}

describe("ids of records", () => {
  it("are kept by parseContent, and a broken one is dropped", () => {
    const parsed = parseContent(schema, {
      ...content,
      practices: [
        { ...content.practices[0], id: "../../etc" },
        content.practices[1],
      ],
    });

    expect(parsed.content.practices.map((practice) => practice.id)).toEqual([
      undefined,
      "qigong",
    ]);
  });

  it("are given once to records without one, and anew to a copy", () => {
    const parsed = parseContent(schema, {
      ...content,
      practices: [
        { name: "Без id", teacher: null, isHidden: false },
        content.practices[1],
        content.practices[1],
      ],
    });

    const given = withRecordIds(schema, parsed.content, counter());

    expect(given.practices.map((practice) => practice.id)).toEqual([
      "new-1",
      "qigong",
      "new-2",
    ]);
    expect(given.studio.teachers.map((teacher) => teacher.id)).toEqual([
      "oksana",
      "elena",
    ]);
    expect(withRecordIds(schema, given, counter())).toEqual(given);
  });

  it("are given inside groups of groups and records of records too", () => {
    const nested = defineSchema({
      site: group({
        label: "Сайт",
        fields: {
          menu: group({
            label: "Меню",
            fields: {
              sections: collection({
                label: "Разделы",
                item: {
                  dishes: collection({
                    label: "Блюда",
                    item: { name: text({ label: "Блюдо" }) },
                  }),
                },
              }),
            },
          }),
        },
      }),
    });
    const parsed = parseContent(nested, {
      site: {
        menu: { sections: [{ dishes: [{ name: "Суп" }, { name: "Чай" }] }] },
      },
    });

    const given = withRecordIds(nested, parsed.content, counter());

    const section = given.site.menu.sections[0];
    expect(section?.id).toBe("new-1");
    expect(section?.dishes.map((dish) => dish.id)).toEqual(["new-2", "new-3"]);
  });

  it("start a new record with its fields empty", () => {
    expect(newRecord(schema.practices, "fresh")).toEqual({
      id: "fresh",
      name: "",
      teacher: null,
      isHidden: false,
    });
  });
});

describe("references", () => {
  it("give a site ids to find records by", () => {
    type Practice = ContentOf<typeof schema>["practices"][number];
    const parsed = parseContent(schema, content).content;
    const yin = parsed.practices[0];

    expectTypeOf<Practice["teacher"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Practice["id"]>().toEqualTypeOf<string | undefined>();
    expect(parseContent(schema, content).issues).toEqual([]);
    expect(findRecord(parsed.studio.teachers, yin?.teacher ?? null)?.name).toBe(
      "Оксана",
    );
    expect(findRecord(parsed.studio.teachers, null)).toBeUndefined();
  });

  it("keep a reference to a removed record, with an issue", () => {
    const parsed = parseContent(schema, {
      ...content,
      studio: { teachers: [content.studio.teachers[1]] },
      featured: ["qigong", "gone"],
    });

    expect(parsed.content.practices[0]?.teacher).toBe("oksana");
    expect(parsed.issues).toEqual([
      {
        path: ["practices", 0, "teacher"],
        code: "missing-record",
        id: "oksana",
      },
      { path: ["featured"], code: "missing-record", id: "gone" },
    ]);
  });

  it("are checked inside groups of groups, against a collection inside a group", () => {
    const nested = defineSchema({
      ...schema,
      home: group({
        label: "Главная",
        fields: {
          hero: group({
            label: "Первый экран",
            fields: {
              teacher: reference({
                label: "Лицо студии",
                collection: "studio.teachers",
              }),
            },
          }),
        },
      }),
    });

    const parsed = parseContent(nested, {
      ...content,
      home: { hero: { teacher: "gone" } },
    });

    expect(parsed.issues).toEqual([
      { path: ["home", "hero", "teacher"], code: "missing-record", id: "gone" },
    ]);
  });

  it("take only ids, each once", () => {
    const parsed = parseContent(schema, {
      ...content,
      featured: ["yin", "yin"],
    });
    const broken = parseContent(schema, { ...content, featured: [42] });

    expect(parsed.content.featured).toEqual(["yin"]);
    expect(broken.issues).toEqual([
      { path: ["featured"], code: "invalid-type" },
    ]);
  });

  it("are one field each on a page, like picked options", () => {
    type Content = ContentOf<typeof schema>;
    const edit = editable<Content>();

    expect(edit("featured")).toEqual({ "data-cms-path": "featured" });
    expectTypeOf<["featured", number]>().not.toExtend<ContentPath<Content>>();
  });
});

describe("collectionAt", () => {
  it("finds a collection by its name or a path through groups, with its records", () => {
    const parsed = parseContent(schema, content).content;

    expect(collectionAt(schema, parsed, "practices")?.records).toHaveLength(2);
    expect(collectionAt(schema, parsed, "studio.teachers")?.collection).toBe(
      schema.studio.fields.teachers,
    );
    expect(collectionAt(schema, parsed, "studio")).toBeUndefined();
    expect(collectionAt(schema, parsed, "featured")).toBeUndefined();
    expect(collectionAt(schema, parsed, "practices.0")).toBeUndefined();
  });
});
