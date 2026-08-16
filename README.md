# skinsrestorer.net

The code for our website and documentation!

<p align="center">
  <a rel="noopener noreferrer" target="_blank" href="https://vercel.com/?utm_source=skinsrestorer&utm_campaign=oss">
    <img height="34px" src="/public/assets/powered-by-vercel.svg" alt="Powered by vercel">
  </a>
</p>

## Development

Install dependencies and start the local Next.js server:

```bash
pnpm install
pnpm dev
```

Set `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` to the public site key paired with Axolotl's `HCAPTCHA_SITE_KEY`. The upload and generator tools require this value when a cape upload uses Axolotl. Keep the matching hCaptcha secret only in Axolotl's server environment.
