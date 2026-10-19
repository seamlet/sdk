// Every page of the site loads this, so it stays tiny: the bridge itself is loaded only on the
// preview, in the frame of the CMS's editor. Elsewhere nothing more is fetched.
import { cmsOrigin } from "virtual:seamlet/config";
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
