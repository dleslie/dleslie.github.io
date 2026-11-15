// Generated from blog.org by scripts/export-org.el — do not edit manually.
window.__BLOG_POSTS__ = [
  {
    "id": "2026-11-14-welcome-to-the-wire",
    "title": "Welcome to the wire",
    "date": "2026-11-14",
    "tags": [
      "meta",
      "web"
    ],
    "html": "<p>\nThis site is built in the spirit of the pre-HTTP internet: plain text first,\nminimal markup, zero trackers, and no client-side framework bloat.\n</p>\n\n<p>\nBlog entries live in <code>blog.org</code> and are exported to static data via <code>make</code>\nusing Emacs in batch mode. Public repository metadata and recent activity\nare queried directly from GitHub's API for <code>dleslie</code>.\n</p>\n\n<p>\nIf you are looking for a project's live page, clicking a repository in the\ntable below will route to its GitHub Pages deployment when available, or\ndirectly to its source repository otherwise.</p>"
  },
  {
    "id": "2026-11-10-notes-on-building-static-things-to-last",
    "title": "Notes on building static things to last",
    "date": "2026-11-10",
    "tags": [
      "engineering"
    ],
    "html": "<p>\nA personal site should outlive the current decade's build tools:\n</p>\n\n<ul class=\"org-ul\">\n<li>Keep the source in plain text (<code>org-mode</code>).</li>\n<li>Keep the build step a single <code>Makefile</code> invoking standard tools.</li>\n<li>Keep the output static HTML, CSS, and vanilla JavaScript.</li>\n</ul>\n\n<div class=\"org-src-container\">\n<pre class=\"src src-text\">emacs -Q --batch -&gt; data/posts.json + data/posts.js -&gt; index.html\n</pre>\n</div>"
  }
];
