// Dragging files from the computer: told apart from dragging text or an element of a page.

export function carriesFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes("Files") === true;
}
