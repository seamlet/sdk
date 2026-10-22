import { describe, expect, it } from "vitest";
import {
  isUploadedPhoto,
  MAX_DRAFT_BYTES,
  readDraft,
} from "./preview-requests";

function post(body: string, type = "application/json"): Request {
  return new Request("http://localhost/preview", {
    method: "POST",
    headers: { "Content-Type": type },
    body,
  });
}

async function statusOf(request: Request): Promise<number | undefined> {
  const reading = await readDraft(request);
  return reading.isRead ? undefined : reading.response.status;
}

describe("readDraft", () => {
  it("reads the draft the bridge sends", async () => {
    expect(await readDraft(post('{"title":"Кофейня"}'))).toEqual({
      isRead: true,
      draft: { title: "Кофейня" },
    });
  });

  it("refuses what a form of another site could send", async () => {
    expect(await statusOf(post('{"title":"x"}', "text/plain"))).toBe(415);
  });

  it("refuses a body that is not JSON or is too big", async () => {
    expect(await statusOf(post("{"))).toBe(400);
    expect(await statusOf(post(`"${"a".repeat(MAX_DRAFT_BYTES)}"`))).toBe(413);
  });
});

describe("isUploadedPhoto", () => {
  it("takes only the names the CMS gives uploads", () => {
    expect(isUploadedPhoto("0123abcd.webp")).toBe(true);
    expect(isUploadedPhoto("../accounts.json")).toBe(false);
    expect(isUploadedPhoto(undefined)).toBe(false);
  });
});
