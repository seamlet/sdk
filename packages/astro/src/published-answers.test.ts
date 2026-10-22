import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchPublishedAnswer,
  PUBLISHED_CONTENT_TIMEOUT_MS,
  readPublishedAnswer,
} from "./published-answers";

const url = new URL("https://cms.seamlet.ru/api/sites/my-site/published");

describe("readPublishedAnswer", () => {
  it("reads what the CMS published", async () => {
    const answer = await readPublishedAnswer(
      Response.json({ title: "Студия" }),
      url,
    );

    expect(answer).toEqual({
      status: "published",
      content: { title: "Студия" },
    });
  });

  it("tells a site the CMS does not know yet", async () => {
    const response = Response.json({ error: "unknown-site" }, { status: 404 });

    await expect(readPublishedAnswer(response, url)).resolves.toEqual({
      status: "unknown-site",
    });
  });

  it("stops at any other refusal, naming the address", async () => {
    const elsewhere = new Response("Not Found", { status: 404 });
    const broken = new Response(null, { status: 500 });

    await expect(readPublishedAnswer(elsewhere, url)).rejects.toThrow(
      "https://cms.seamlet.ru/api/sites/my-site/published failed with status 404",
    );
    await expect(readPublishedAnswer(broken, url)).rejects.toThrow(
      "failed with status 500",
    );
  });
});

describe("fetchPublishedAnswer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("gives up on a CMS that does not answer in time, naming the address", async () => {
    const timeout = vi
      .spyOn(AbortSignal, "timeout")
      .mockImplementation(() =>
        AbortSignal.abort(new DOMException("timed out", "TimeoutError")),
      );
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: URL, init?: RequestInit) =>
        Promise.reject(init?.signal?.reason as Error),
      ),
    );

    await expect(fetchPublishedAnswer(url)).rejects.toThrow(
      "Loading the published content from https://cms.seamlet.ru/api/sites/my-site/published failed: the CMS did not answer",
    );
    expect(timeout).toHaveBeenCalledWith(PUBLISHED_CONTENT_TIMEOUT_MS);
    timeout.mockRestore();
  });
});
