export function ensureHttpsTextureUrl(
  url: string | null | undefined,
): string | null | undefined {
  if (!url) {
    return url;
  }

  return url.replace(/^http:\/\//i, "https://");
}
