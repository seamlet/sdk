import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import process from "node:process";
import {
  HOME_PAGE_PATH,
  readSiteDescription,
  SITE_DESCRIPTION_PATH,
  type SiteDescription,
} from "./schema";
import { unmarkedTextsOf } from "./bridge/unmarked-texts";
import { pageBodyOf } from "./html-page-nodes";
import { PREVIEW_PATH } from "./site-addresses";
import { checkedPagesOf, type PageTexts } from "./text-checks";

// The pages of a build as the CMS's editor first shows them: the built server of `@astrojs/node`,
// started on this computer for a moment, renders each page of the site's description in its
// preview with the initial content, the way the editor renders a draft. Nothing leaves the
// computer: the preview renders a draft without asking the CMS.

/** What `ASTRO_NODE_AUTOSTART` says so the node adapter's entry does not start its own server. */
const AUTOSTART_DISABLED = "disabled";
const LOOPBACK = "127.0.0.1";
/** A page takes far less to render; a page that takes longer is reported as not rendered. */
const RENDER_TIMEOUT_MS = 30_000;

type NodeHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => unknown;

/** The unmarked texts of every page of the built site whose server entry is at the address. */
export async function unmarkedTextsOfBuild(
  serverEntry: URL,
): Promise<PageTexts[]> {
  const handler = await loadHandler(serverEntry);
  const server = createServer((request, response) => {
    void handler(request, response);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, LOOPBACK, resolve);
  });
  const { port } = server.address() as AddressInfo;
  const origin = `http://${LOOPBACK}:${String(port)}`;

  try {
    return await unmarkedTextsAt(origin);
  } finally {
    server.close();
  }
}

async function unmarkedTextsAt(origin: string): Promise<PageTexts[]> {
  const description = await fetchDescription(origin);
  const pages = checkedPagesOf(description);
  const draft = JSON.stringify(description.initialContent);

  const checked: PageTexts[] = [];
  for (const page of pages) {
    const html = await renderPreview(origin, page.path, draft);
    const body = pageBodyOf(html);
    const texts = body === undefined ? [] : unmarkedTextsOf(body);
    checked.push({ page, texts });
  }
  return checked;
}

async function loadHandler(serverEntry: URL): Promise<NodeHandler> {
  const before = process.env.ASTRO_NODE_AUTOSTART;
  process.env.ASTRO_NODE_AUTOSTART = AUTOSTART_DISABLED;
  try {
    const entry = (await import(serverEntry.href)) as { handler?: unknown };
    if (typeof entry.handler !== "function") {
      throw new Error(
        `${serverEntry.pathname} exports no handler of @astrojs/node`,
      );
    }
    return entry.handler as NodeHandler;
  } finally {
    if (before === undefined) delete process.env.ASTRO_NODE_AUTOSTART;
    else process.env.ASTRO_NODE_AUTOSTART = before;
  }
}

async function fetchDescription(origin: string): Promise<SiteDescription> {
  const response = await fetch(new URL(SITE_DESCRIPTION_PATH, origin), {
    signal: AbortSignal.timeout(RENDER_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(
      `${SITE_DESCRIPTION_PATH} answered ${String(response.status)}`,
    );
  }
  const description = readSiteDescription(await response.json());
  if (description === undefined) {
    throw new Error(`${SITE_DESCRIPTION_PATH} is not a description of a site`);
  }
  return description;
}

async function renderPreview(
  origin: string,
  path: string,
  draft: string,
): Promise<string> {
  const address =
    path === HOME_PAGE_PATH ? PREVIEW_PATH : `${PREVIEW_PATH}${path}`;
  const response = await fetch(new URL(address, origin), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: draft,
    signal: AbortSignal.timeout(RENDER_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(
      `the preview of ${path} answered ${String(response.status)}`,
    );
  }
  return response.text();
}
