EMACS ?= emacs
CURL ?= curl
JQ ?= jq
NODE ?= node
PYTHON ?= python3
PORT ?= 8000
GITHUB_USER ?= dleslie

POSTS_SRC := blog.org
EXPORT_SCRIPT := scripts/export-org.el
POSTS_JSON := data/posts.json
POSTS_JS := data/posts.js
GITHUB_FALLBACK := data/github-fallback.js

.PHONY: all build fetch check serve clean help

all: build

build: $(POSTS_JSON) $(POSTS_JS)

$(POSTS_JSON) $(POSTS_JS): $(POSTS_SRC) $(EXPORT_SCRIPT)
	$(EMACS) -Q --batch --script $(EXPORT_SCRIPT)

fetch:
	@mkdir -p data
	@repos=$$($(CURL) -fsSL -H "Accept: application/vnd.github+json" \
		"https://api.github.com/users/$(GITHUB_USER)/repos?type=owner&per_page=100&sort=updated"); \
	events=$$($(CURL) -fsSL -H "Accept: application/vnd.github+json" \
		"https://api.github.com/users/$(GITHUB_USER)/events/public?per_page=30"); \
	ts=$$(date -u +"%Y-%m-%dT%H:%M:%SZ"); \
	{ \
		printf '// Snapshot fetched by `make fetch` on %s.\n' "$$ts"; \
		printf 'window.__GITHUB_FALLBACK__ = '; \
		$(JQ) -n --argjson repos "$$repos" --argjson events "$$events" --arg fetchedAt "$$ts" \
			'{repos: $$repos, events: $$events, fetchedAt: $$fetchedAt}'; \
		printf ';\n'; \
	} > $(GITHUB_FALLBACK)
	@echo "Updated $(GITHUB_FALLBACK)"

check: build
	$(JQ) empty $(POSTS_JSON)
	$(NODE) --check app.js
	$(NODE) --check $(POSTS_JS)
	$(NODE) --check $(GITHUB_FALLBACK)
	@echo "All checks passed."

serve:
	$(PYTHON) -m http.server $(PORT)

clean:
	rm -f $(POSTS_JSON) $(POSTS_JS)

help:
	@echo "dleslie.github.io — static site build & maintenance"
	@echo ""
	@echo "How to rebuild after writing or editing a blog post:"
	@echo "  1. Edit $(POSTS_SRC) (top-level * headings are posts; use :DATE: YYYY-MM-DD"
	@echo "     in :PROPERTIES: or an Org timestamp; tag :draft: or mark DRAFT to skip)."
	@echo "  2. Run 'make' (or 'make check') to export $(POSTS_JSON) and $(POSTS_JS)"
	@echo "     via Emacs in batch mode ($(EMACS) -Q --batch --script $(EXPORT_SCRIPT))."
	@echo "  3. Optionally run 'make serve' to preview at http://localhost:$(PORT)."
	@echo "  4. Commit $(POSTS_SRC), $(POSTS_JSON), and $(POSTS_JS) and push to GitHub."
	@echo ""
	@echo "Targets:"
	@echo "  make          Export $(POSTS_SRC) -> $(POSTS_JSON) + $(POSTS_JS)"
	@echo "  make fetch    Refresh $(GITHUB_FALLBACK) from GitHub API (offline fallback)"
	@echo "  make check    Rebuild posts and validate JSON/JavaScript syntax"
	@echo "  make serve    Serve site locally on http://localhost:$(PORT)"
	@echo "  make clean    Remove generated $(POSTS_JSON) and $(POSTS_JS)"
	@echo "  make help     Show this rebuild guide and target reference"
