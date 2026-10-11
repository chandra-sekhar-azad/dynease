# Dynease brand kit

- `logo/` horizontal lockup (for light backgrounds), reversed (for dark backgrounds) and lockup with tagline. SVG + PNG (1600 px wide, transparent).
- `icons/favicon/` favicon.ico (16/32/48), PNGs and an SVG favicon. The 16 and 32 px versions use a simplified mark (plate and orange dot) so they stay sharp in browser tabs.
- `icons/apple/` apple-touch-icon (180) plus 120/152/167 and the 1024 App Store icon. Opaque and full-bleed, because iOS rounds the corners itself.
- `icons/android/` 192 and 512 icons, plus maskable versions (extra padding so Android's shape masks don't clip the artwork).
- `icons/windows/` 150x150 tile and browserconfig.xml.
- `source/` master SVGs and a 1024 px PNG for future exports.

## Using it in your Vite project
1. Copy the `icons/` folder and `site.webmanifest` into your project's `public/` folder.
2. Paste the contents of `head-snippet.html` into `<head>` in `index.html`.
3. Use `logo/logo-horizontal.svg` (import it or put it in `public/`) for your navbar.

Colors: green #0f8a4b / #138a4a, dark green #0b3d26, accent orange #ff6a00, mint #effaf3. Typeface: Inter ExtraBold.
