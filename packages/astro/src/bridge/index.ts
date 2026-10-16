// The bridge on a site's preview, so the CMS's editor edits the site's own page. @seamlet/astro
// puts it on the preview it adds to the site; `connectPage` is the bridge of a page the editor has
// connected to, for the editor's own tests.
export {
  connectPage,
  connectToEditor,
  type BridgeOptions,
} from "./connect-to-editor";
