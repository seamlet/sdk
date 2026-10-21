// Every page of the site loads this, so it stays tiny: the bridge itself is loaded only on the
// preview, in the frame of the CMS's editor, and the sending of requests only on a page with a form
// of them. Elsewhere nothing more is fetched.
import { cmsOrigin } from "virtual:seamlet/config";
import { PREVIEW_PATH } from "./site-addresses";

/** The forms of requests `RequestForm.astro` renders; request-sending.ts names the same. */
const REQUEST_FORM_SELECTOR = "form[data-seamlet-form]";

const isFramed = window.parent !== window;
const { pathname } = window.location;
const isPreview =
  pathname === PREVIEW_PATH || pathname.startsWith(`${PREVIEW_PATH}/`);

if (isFramed && isPreview) {
  void import("./bridge").then(({ connectToEditor }) => {
    connectToEditor({ editorOrigin: cmsOrigin });
  });
}

if (document.querySelector(REQUEST_FORM_SELECTOR) !== null) {
  void import("./request-sending").then(({ connectRequestForms }) => {
    connectRequestForms(document, { isPreview });
  });
}
