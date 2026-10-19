// What the preview takes from a request: a draft of the editor, and the name of a photo it fetches
// from the CMS.

/** Far more than the content of a site ever takes; a bigger body is not a draft. */
export const MAX_DRAFT_BYTES = 1024 * 1024;
const BAD_REQUEST = 400;
const PAYLOAD_TOO_LARGE = 413;
const UNSUPPORTED_MEDIA_TYPE = 415;
const UPLOADED_PHOTO = /^[A-Za-z0-9_-]+\.webp$/u;

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

/** Whether a name can be a photo uploaded to the CMS: the hash of its bytes, as WebP. */
export function isUploadedPhoto(
  fileName: string | undefined,
): fileName is string {
  return fileName !== undefined && UPLOADED_PHOTO.test(fileName);
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

function refused(status: number): DraftReading {
  return { isRead: false, response: new Response(null, { status }) };
}
