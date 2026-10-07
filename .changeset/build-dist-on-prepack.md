---
"@wc-toolkit/wctools": patch
"@wc-toolkit/language-server": patch
---

Build output is now generated on `prepack`, so published tarballs always include `dist/` (and `bin/`). Previously these packages could be published without their build output, which left the `wctools` and `wc-language-server` `bin` entries pointing at missing files and made the CLIs unusable after install.
