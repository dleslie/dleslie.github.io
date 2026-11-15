# dleslie.github.io

Personal and professional site for `dleslie`, hosted as a static site on GitHub Pages with a pre-HTTP, plain-text aesthetic.

## Structure

- `index.html`, `style.css`, `app.js` — static page, styling, and client-side GitHub/feed logic
- `blog.org` — Emacs Org-mode source for blog entries
- `scripts/export-org.el` — batch Emacs Lisp exporter (`blog.org` → `data/posts.json` + `data/posts.js`)
- `data/github-fallback.js` — optional offline/rate-limit snapshot of GitHub repos and events
- `Makefile` — build, fetch, check, and local preview automation
- `.nojekyll` — disables Jekyll processing on GitHub Pages

## Adding New Blog Posts

1. Open `blog.org` and add a top-level (`*`) heading:

   ```org
   * My post title :tag1:tag2:
   :PROPERTIES:
   :DATE: 2026-11-14
   :END:

   Post body in standard Org-mode syntax.
   ```

   - **Dates**: Set `:DATE: YYYY-MM-DD` in `:PROPERTIES:` (or include an Org timestamp in the entry; otherwise the export date is used).
   - **Drafts**: Mark a heading `DRAFT` or `TODO`, or add the `:draft:` or `:noexport:` tag to exclude it from export.

2. Rebuild the static post data:

   ```sh
   make check
   ```

   This runs `emacs -Q --batch --script scripts/export-org.el` and validates the generated `data/posts.json` and JS files.

3. Commit `blog.org`, `data/posts.json`, and `data/posts.js` and push to `master`.

## Updating the Feed

The feed combines two sources in chronological order:

- **Blog entries**: Loaded from `data/posts.js` (generated from `blog.org` via `make`).
- **Repository updates**: Queried live in the browser from the GitHub API (`users/dleslie/events/public` and non-fork `pushed_at` timestamps from `users/dleslie/repos`), filtered to changes authored by `dleslie` in `dleslie` repositories, and cached in `sessionStorage` for 5 minutes.

To refresh the offline/rate-limit fallback snapshot (`data/github-fallback.js`), run:

```sh
make fetch
```

## Including / Excluding Repositories

- **Table**: `app.js` (`fetchAllPublicRepos`) queries all public repositories owned by `dleslie` (`type=owner`) and sorts them by **last updated** (default), **starred**, or **name**.
- **Feed**: `app.js` (`buildFeedItems`) includes public events where `actor.login` is `dleslie` on `dleslie` repositories, and skips forks in the supplemental `pushed_at` fallback.
- **Excluding specific repos**: Make a repository private on GitHub to remove it automatically, or add a name filter in `fetchAllPublicRepos()` in `app.js` if you want to hide specific public repos from the site.
- **Click targets**: Repositories with GitHub Pages enabled (`has_pages: true`) link to `https://dleslie.github.io/<repo>/` (or `https://dleslie.github.io/` for `dleslie.github.io`); all others link to their GitHub repository (`html_url`).

## Local Preview & Make Targets

```sh
make          # Export blog.org -> data/posts.json + data/posts.js
make fetch    # Refresh data/github-fallback.js from GitHub API
make check    # Rebuild posts and validate JSON/JS syntax
make serve    # Preview locally at http://localhost:8000
make clean    # Remove generated data/posts.json and data/posts.js
make help     # Print rebuild guide and target summary
```
