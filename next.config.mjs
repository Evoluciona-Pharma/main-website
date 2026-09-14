/**
 * STATIC_EXPORT=1 → plain files in `out/` for GitHub Pages.
 * Otherwise → Node standalone (Docker / `next start`).
 * NEXT_PUBLIC_BASE_PATH is the Pages subdirectory (`/Site`); empty locally.
 */
const isExport = process.env.STATIC_EXPORT === '1';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: import.meta.dirname,
  ...(isExport
    ? {
        output: 'export',
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : { output: 'standalone' }),
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
};

export default nextConfig;
