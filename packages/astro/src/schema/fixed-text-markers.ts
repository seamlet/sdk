// How a site tells the checks of @seamlet/astro that a text of its page belongs to its code, not to
// its content: the words of controls («К содержанию», «Назад»), a fixed legal text, what the code
// builds (an open status, a sum, the year of the copyright line). The editor cannot reach a text
// without a field's marker, so the checks name every such text a site did not mark either way.

/** On an element whose texts the code owns: `<span data-cms-fixed>© 2026</span>`. */
export const FIXED_TEXT_ATTRIBUTE = "data-cms-fixed";
