// Every page of the site loads this, so it stays tiny: the bridge itself is loaded only on the
// preview, in the frame of the CMS's editor, and the sending of requests only on a page with a form
// of them. Elsewhere nothing more is fetched.
import { cmsOrigin } from "virtual:seamlet/config";
import { REQUEST_FORM_SELECTOR } from "./request-form-markers";
import { PREVIEW_PATH } from "./site-addresses";

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
