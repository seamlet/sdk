// How a site tells the CMS's editor that a part of its page moves: a marquee, a flipping board, a
// turning stamp. A text that moves cannot be typed where it stands, and a moving thing is hard to
// click, so a field inside such a part is edited in the editor's popover, and in the editor the
// part holds still while the pointer is over it and once it is chosen.

/** On a part that moves: `<div data-cms-popover>`, or on the marked element itself. */
export const POPOVER_ATTRIBUTE = "data-cms-popover";
/**
 * Set by the bridge on a moving part it holds still. The bridge pauses the part's CSS animations
 * and transitions itself; a site that moves the part with a script stops it while this is set.
 */
export const HELD_ATTRIBUTE = "data-cms-held";
