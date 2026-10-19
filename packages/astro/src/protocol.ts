// What the CMS's editor needs to speak to the bridge on a site's preview: the messages and the
// rules both sides share. Sites never import it; the editor does, from the same package version
// line as the sites it edits.
export {
  PROTOCOL_VERSION,
  readEditorMessage,
  readPageMessage,
  type EditorKey,
  type EditorMessage,
  type LinkBox,
  type MarkerBox,
  type PageLayout,
  type PageMessage,
  type Point,
} from "./bridge/messages";
export type { Box, Viewport } from "./bridge/boxes";
export { shortcutOf, type Shortcut } from "./bridge/editor-shortcuts";
export { carriesFiles } from "./bridge/file-drags";
export { imageFieldAt } from "./bridge/image-fields";
export type { InlineEditingOutcome } from "./bridge/inline-text-editing";
export { closestMarkedPath } from "./bridge/marked-paths";
export type { TextFormat, TypedSelection } from "./bridge/rich-text-editing";
export {
  insertPlainText,
  readRichTextFrom,
  readSelectionFrom,
  renderRichText,
  selectIn,
} from "./bridge/rich-text-dom";
export {
  formatsAt,
  isCollapsed,
  linkSelectionAt,
  setLink,
  toggleList,
  toggleMark,
  type Mark,
  type TextFormats,
  type TextPoint,
  type TextSelection,
} from "./bridge/rich-text-edits";
export { isOwnPhotoSrc, OWN_PHOTOS_PATH, ownPhotoPath } from "./own-photos";
