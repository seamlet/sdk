import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { copiedMediaFile, uploadHeadersOf } from "./copied-media";

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "seamlet-copied-media-"));
  await writeFile(
    join(directory, "0123456789abcdef.webp"),
    new Uint8Array([1]),
  );
  await writeFile(join(directory, "price_list.pdf"), new Uint8Array([2]));
  await mkdir(join(directory, "..", "seamlet-outside"), { recursive: true });
  await writeFile(join(directory, "..", "seamlet-outside", "secret.webp"), "x");
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
  await rm(join(directory, "..", "seamlet-outside"), {
    recursive: true,
    force: true,
  });
});

describe("copiedMediaFile", () => {
  it("reads a photo and a document under the names the CMS gives them", async () => {
    const photo = await copiedMediaFile(directory, "0123456789abcdef.webp");
    const document = await copiedMediaFile(directory, "price_list.pdf");

    expect([...(photo ?? [])]).toEqual([1]);
    expect([...(document ?? [])]).toEqual([2]);
  });

  it("has nothing for an upload that is not in the folder", async () => {
    await expect(
      copiedMediaFile(directory, "ffffffffffffffff.webp"),
    ).resolves.toBeUndefined();
  });

  it("reads nothing outside the folder or by a name the CMS never gives", async () => {
    await expect(
      copiedMediaFile(directory, "../seamlet-outside/secret.webp"),
    ).resolves.toBeUndefined();
    await expect(copiedMediaFile(directory, "..")).resolves.toBeUndefined();
    await expect(
      copiedMediaFile(directory, "photo.jpg"),
    ).resolves.toBeUndefined();
  });
});

describe("uploadHeadersOf", () => {
  it("names a photo by its name and keeps a browser from guessing another type", () => {
    const headers = uploadHeadersOf("0123456789abcdef.webp");

    expect(headers.get("Content-Type")).toBe("image/webp");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Content-Disposition")).toBeNull();
  });

  it("hands a document out to be saved, never shown", () => {
    const headers = uploadHeadersOf("price_list.pdf");

    expect(headers.get("Content-Type")).toBe("application/pdf");
    expect(headers.get("Content-Disposition")).toBe("attachment");
  });
});
