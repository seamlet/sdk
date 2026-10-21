// How the page script finds the forms of requests `RequestForm.astro` renders: the script of every
// page asks it before loading the sending, which asks it again.

export const REQUEST_FORM_SELECTOR = "form[data-seamlet-form]";
