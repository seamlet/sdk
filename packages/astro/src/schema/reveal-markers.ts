// How a site shows the CMS what it hides until a visitor acts: an accordion of its own, a step of a
// quiz, a dialog, a tab. A native `<details>` needs nothing, the bridge opens it itself. The editor
// must show a field to let it be edited, so when a field inside such a part is chosen, the bridge
// marks the part revealed and tells the site, which shows it the way it shows it to a visitor.

/** On the element the site hides and shows itself: `<div data-cms-reveal hidden>`. */
export const REVEAL_ATTRIBUTE = "data-cms-reveal";
/** Set by the bridge on a part it revealed; a site can show it with CSS alone. */
export const REVEALED_ATTRIBUTE = "data-cms-revealed";
/** Sent to a revealed part, and bubbling up from it, for a site that shows it with a script. */
export const REVEAL_EVENT = "cms:reveal";
