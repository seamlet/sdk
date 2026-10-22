// Where a site's requests go: an address on the CMS, which the site's forms post to and the CMS's
// route answers at. The texts a visitor consents to are the site's own page (privacy-policy.ts).

/** Where the site's forms send their requests, on the CMS's origin. */
export function requestsPathOf(siteId: string): string {
  return `/api/sites/${siteId}/requests`;
}
