# AGENTS.md

Instructions for AI agents working in this repository (`dleslie.github.io`).

## Overview

This is a static personal and professional website hosted on GitHub Pages for `dleslie`.
It has zero framework or bundler dependencies and uses `.nojekyll` so GitHub Pages serves files directly.

- `index.html`, `style.css`, `app.js`: Root page, styling, and client-side logic.
- `blog.org`: Source of truth for blog-style comments (Emacs Org-mode).
- `scripts/export-org.el`: Batch Emacs Lisp exporter converting `blog.org` into `data/posts.json` and `data/posts.js`.
- `data/github-fallback.js`: Optional offline/rate-limit fallback snapshot of GitHub repos and public events.
- `Makefile`: Build, fetch, check, and local serve automation.

## Aesthetics & Architecture Rules

- **Pre-HTTP aesthetic**: Plain-text / terminal / RFC / Gopher-inspired layout, monospace typography, minimal borders, high contrast, no bloat, no trackers, no third-party UI frameworks.
- **Pure static**: Do not introduce Node build pipelines, bundlers, Jekyll templates, or server-side dependencies.
- **Org-mode workflow**:
  - Never hand-edit `data/posts.json` or `data/posts.js`.
  - Always edit `blog.org` and run `make` to regenerate them.
  - Top-level (`*`) headings in `blog.org` are individual posts.
  - Dates come from `:DATE: YYYY-MM-DD` in `:PROPERTIES:` (or the first Org timestamp in the entry).
  - Headings marked `DRAFT`/`TODO` or tagged `:draft:`/`:noexport:` are excluded from export.
- **GitHub integration**:
  - `app.js` queries `https://api.github.com/users/dleslie/repos` and `.../events/public` directly in the browser, with `sessionStorage` caching (5 minutes) and `window.__GITHUB_FALLBACK__` fallback.
  - Clicking a repository must route to its GitHub Pages URL (`https://dleslie.github.io/<repo>/`, or `https://dleslie.github.io/` for `dleslie.github.io`) when `has_pages` is true, or to `html_url` otherwise.
  - Default repository table sort order is **last updated** (`pushed_at` descending), with interactive sorting by **starred** and **name**.

## Verification

After any change, run:

```sh
make check
```

To preview locally:

```sh
make serve
```

Commit regenerated `data/posts.json` and `data/posts.js` alongside `blog.org` changes so GitHub Pages serves up-to-date posts without an agent or CI step.
