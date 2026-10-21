import {
  collectionAt,
  isContentObject,
  isRecordId,
  newRecord,
  recordAt,
  recordPageAt,
  FIELD_PATH_SEPARATOR,
  type Content,
  type SiteDescription,
} from "./schema";
import { pagePathOf } from "./site-pages";

// What the preview takes from a request: a draft of the editor, the page of a record the editor has
// added, and the name of a photo it fetches from the CMS.

/** Far more than the content of a site ever takes; a bigger body is not a draft. */
export const MAX_DRAFT_BYTES = 1024 * 1024;
const BAD_REQUEST = 400;
const PAYLOAD_TOO_LARGE = 413;
const UNSUPPORTED_MEDIA_TYPE = 415;
const UPLOADED_PHOTO = /^[A-Za-z0-9_-]+\.webp$/u;
/** An upload of the CMS: a photo as WebP or a document as PDF, named by the hash of its bytes. */
const UPLOADED_FILE = /^[A-Za-z0-9_-]+\.(?:webp|pdf)$/u;

/**
 * What every answer of the preview says, a refusal too: only the CMS's editor frames it, and
 * nobody indexes or keeps it.
 */
export function previewHeadersOf(
  cmsOrigin: string,
): Readonly<Record<string, string>> {
  return {
    "Content-Security-Policy": `frame-ancestors ${cmsOrigin}`,
    "X-Robots-Tag": "noindex",
    "Cache-Control": "no-store",
  };
}

export type DraftReading =
  | { readonly isRead: true; readonly draft: unknown }
  | { readonly isRead: false; readonly response: Response };

/**
 * The draft in the JSON body of a request. A form of another site cannot send JSON, so only the
 * page's own bridge renders a draft.
 */
export async function readDraft(request: Request): Promise<DraftReading> {
  const isJson =
    request.headers.get("Content-Type")?.startsWith("application/json") ===
    true;
  if (!isJson) return refused(UNSUPPORTED_MEDIA_TYPE);

  const body = await readLimited(request);
  if (body === undefined) return refused(PAYLOAD_TOO_LARGE);
  try {
    return { isRead: true, draft: JSON.parse(body) as unknown };
  } catch {
    return refused(BAD_REQUEST);
  }
}

/**
 * Whether the address may be a page of the site: one of its pages, or under its pages of records.
 * The preview answers anything else at once, without asking the CMS or reading a draft.
 */
export function isPageAddress(
  description: SiteDescription,
  rest: string | undefined,
): boolean {
  const path = pagePathOf(rest);
  const isOwnPage = description.pages.some((page) => page.path === path);
  const recordPage = recordPageAt(description.recordPages ?? [], path);
  return isOwnPage || recordPage !== undefined;
}

/**
 * The published content, with a blank record when the address is the page of a record it does not
 * have: one the editor added since the publication, at its id. The editor renders its draft on the
 * page at once, so the blank record only brings the page with its bridge to the editor.
 */
export function previewContentAt(
  description: SiteDescription,
  content: Content,
  rest: string | undefined,
): Content {
  const recordPages = description.recordPages ?? [];
  const found = recordPageAt(recordPages, pagePathOf(rest));
  if (found === undefined || !isRecordId(found.address)) return content;

  const { collection: path } = found.page;
  const records = collectionAt(description.schema, content, path);
  if (records === undefined) return content;
  const isPublished =
    recordAt(records.collection, records.records, found.address) !== undefined;
  if (isPublished) return content;

  const blank = newRecord(records.collection, found.address);
  const names = path.split(FIELD_PATH_SEPARATOR);
  return withRecordsAt(content, names, [...records.records, blank]);
}

/** Whether a name can be a photo uploaded to the CMS: the hash of its bytes, as WebP. */
export function isUploadedPhoto(
  fileName: string | undefined,
): fileName is string {
  return fileName !== undefined && UPLOADED_PHOTO.test(fileName);
}

/** Whether a name can be a file uploaded to the CMS: a photo or a document. */
export function isUploadedFile(
  fileName: string | undefined,
): fileName is string {
  return fileName !== undefined && UPLOADED_FILE.test(fileName);
}

/** The body as text, or undefined once it grows past the limit; it is read no further then. */
async function readLimited(request: Request): Promise<string | undefined> {
  if (request.body === null) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_DRAFT_BYTES) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(concatenated(chunks, size));
}

function concatenated(chunks: readonly Uint8Array[], size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** The content with the records of the collection at the names through groups replaced. */
function withRecordsAt(
  content: Content,
  names: readonly string[],
  records: readonly Content[],
): Content {
  const [name, ...rest] = names;
  if (name === undefined) return content;
  if (rest.length === 0) return { ...content, [name]: records };

  const group = content[name];
  return isContentObject(group)
    ? { ...content, [name]: withRecordsAt(group, rest, records) }
    : content;
}

function refused(status: number): DraftReading {
  return { isRead: false, response: new Response(null, { status }) };
}
