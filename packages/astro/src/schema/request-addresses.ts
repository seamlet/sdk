// Where a site's requests go and where the texts a visitor consents to are: addresses on the CMS,
// which the site's forms link to and the CMS's routes answer at.

/** The two texts a form's visitor reads before sending: the consent and the operator's policy. */
export type LegalDocument = "consent" | "privacy";

/** Where the site's forms send their requests, on the CMS's origin. */
export function requestsPathOf(siteId: string): string {
  return `/api/sites/${siteId}/requests`;
}

/** Where the CMS shows a text of the business that owns the site, to anyone. */
export function legalPagePathOf(
  siteId: string,
  document: LegalDocument,
): string {
  return `/legal/${siteId}/${document}`;
}
