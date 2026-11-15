(function () {
  "use strict";

  const GITHUB_USER = "dleslie";
  const GITHUB_API_BASE = "https://api.github.com";
  const CACHE_KEY = "dleslie_github_cache_v1";
  const CACHE_TTL_MS = 5 * 60 * 1000;
  const INITIAL_FEED_LIMIT = 15;
  const MAX_REPO_PAGES = 5;

  const state = {
    posts: [],
    repos: [],
    events: [],
    feedFilter: "all",
    feedLimit: INITIAL_FEED_LIMIT,
    repoSort: "updated",
    sourceMode: "querying"
  };

  const dom = {
    status: document.getElementById("github-status"),
    themeToggle: document.getElementById("theme-toggle"),
    feedList: document.getElementById("feed-list"),
    feedMoreWrap: document.getElementById("feed-more-wrap"),
    feedMoreBtn: document.getElementById("feed-more-btn"),
    repoSummary: document.getElementById("repo-summary"),
    repoTbody: document.getElementById("repo-tbody"),
    feedFilterBtns: Array.from(document.querySelectorAll("[data-feed-filter]")),
    repoSortBtns: Array.from(document.querySelectorAll("[data-repo-sort]"))
  };

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatIsoDate(isoString) {
    if (!isoString) {
      return "----";
    }
    return String(isoString).slice(0, 10);
  }

  /**
   * Resolve the click target for a repository:
   * GitHub Pages URL when Pages is enabled, otherwise the repository URL.
   */
  function resolveRepoDestination(repo) {
    if (repo && repo.has_pages) {
      const name = String(repo.name || "");
      const pagesUrl =
        name.toLowerCase() === GITHUB_USER + ".github.io"
          ? "https://" + GITHUB_USER + ".github.io/"
          : "https://" + GITHUB_USER + ".github.io/" + encodeURIComponent(name) + "/";
      return { url: pagesUrl, kind: "pages" };
    }
    return {
      url: (repo && repo.html_url) || "https://github.com/" + GITHUB_USER,
      kind: "repo"
    };
  }

  function loadBlogPosts() {
    if (Array.isArray(window.__BLOG_POSTS__)) {
      state.posts = window.__BLOG_POSTS__;
      return Promise.resolve();
    }
    return fetch("data/posts.json")
      .then((res) => (res.ok ? res.json() : []))
      .then((posts) => {
        state.posts = Array.isArray(posts) ? posts : [];
      })
      .catch(() => {
        state.posts = [];
      });
  }

  function readSessionCache() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.ts !== "number") {
        return null;
      }
      if (Date.now() - parsed.ts > CACHE_TTL_MS) {
        return null;
      }
      return parsed;
    } catch (_err) {
      return null;
    }
  }

  function writeSessionCache(repos, events) {
    try {
      sessionStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ ts: Date.now(), repos: repos, events: events })
      );
    } catch (_err) {
      // Ignore storage quota errors in restricted browsing modes.
    }
  }

  function parseNextLink(linkHeader) {
    if (!linkHeader) {
      return null;
    }
    const parts = linkHeader.split(",");
    for (let i = 0; i < parts.length; i += 1) {
      const match = parts[i].match(/<([^>]+)>;\s*rel="next"/);
      if (match) {
        return match[1];
      }
    }
    return null;
  }

  async function fetchAllPublicRepos() {
    let url =
      GITHUB_API_BASE +
      "/users/" +
      GITHUB_USER +
      "/repos?type=owner&per_page=100&sort=updated";
    const all = [];
    let page = 0;

    while (url && page < MAX_REPO_PAGES) {
      const res = await fetch(url, {
        headers: { Accept: "application/vnd.github+json" }
      });
      if (!res.ok) {
        throw new Error("GitHub repos API returned " + res.status);
      }
      const batch = await res.json();
      if (Array.isArray(batch)) {
        for (let i = 0; i < batch.length; i += 1) {
          if (!batch[i].private) {
            all.push(batch[i]);
          }
        }
      }
      url = parseNextLink(res.headers.get("Link"));
      page += 1;
    }
    return all;
  }

  async function fetchPublicEvents() {
    const url =
      GITHUB_API_BASE + "/users/" + GITHUB_USER + "/events/public?per_page=30";
    const res = await fetch(url, {
      headers: { Accept: "application/vnd.github+json" }
    });
    if (!res.ok) {
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  async function loadGitHubData() {
    const cached = readSessionCache();
    if (cached) {
      state.repos = cached.repos || [];
      state.events = cached.events || [];
      state.sourceMode = "cached (session)";
      return;
    }

    try {
      const [repos, events] = await Promise.all([
        fetchAllPublicRepos(),
        fetchPublicEvents()
      ]);
      state.repos = repos;
      state.events = events;
      state.sourceMode = "live";
      writeSessionCache(repos, events);
    } catch (_err) {
      const fallback = window.__GITHUB_FALLBACK__;
      if (fallback && Array.isArray(fallback.repos) && fallback.repos.length > 0) {
        state.repos = fallback.repos;
        state.events = Array.isArray(fallback.events) ? fallback.events : [];
        state.sourceMode = "fallback snapshot";
      } else {
        state.repos = [];
        state.events = [];
        state.sourceMode = "unavailable";
      }
    }
  }

  function buildRepoMap() {
    const map = new Map();
    for (let i = 0; i < state.repos.length; i += 1) {
      const repo = state.repos[i];
      if (repo && repo.name) {
        map.set(repo.name.toLowerCase(), repo);
        if (repo.full_name) {
          map.set(repo.full_name.toLowerCase(), repo);
        }
      }
    }
    return map;
  }

  function summarizeEvent(ev) {
    const payload = ev.payload || {};
    if (ev.type === "PushEvent") {
      const commits = Array.isArray(payload.commits) ? payload.commits : [];
      const branch = String(payload.ref || "").replace("refs/heads/", "");
      const count = payload.size || commits.length || 1;
      const headMsg = commits.length > 0 ? String(commits[commits.length - 1].message || "").split("\n")[0] : "";
      const prefix = "pushed " + count + (count === 1 ? " commit" : " commits") + (branch ? " to " + branch : "");
      return headMsg ? prefix + " — " + headMsg : prefix;
    }
    if (ev.type === "CreateEvent") {
      const refType = payload.ref_type || "repository";
      const ref = payload.ref ? " (" + payload.ref + ")" : "";
      return "created " + refType + ref;
    }
    if (ev.type === "ReleaseEvent" && payload.release) {
      return "released " + (payload.release.tag_name || payload.release.name || "new version");
    }
    if (ev.type === "PublicEvent") {
      return "open-sourced repository";
    }
    return null;
  }

  function buildFeedItems() {
    const items = [];
    const repoMap = buildRepoMap();
    const coveredRepoNames = new Set();

    for (let i = 0; i < state.posts.length; i += 1) {
      const post = state.posts[i];
      items.push({
        type: "blog",
        date: formatIsoDate(post.date),
        sortKey: String(post.date || "") + "T23:59:59Z",
        title: post.title || "Untitled",
        tags: Array.isArray(post.tags) ? post.tags : [],
        html: post.html || ""
      });
    }

    for (let i = 0; i < state.events.length; i += 1) {
      const ev = state.events[i];
      // Only show changes authored by GITHUB_USER in repositories owned by GITHUB_USER.
      const actorLogin = (ev.actor && ev.actor.login ? String(ev.actor.login) : "").toLowerCase();
      if (actorLogin !== GITHUB_USER) {
        continue;
      }
      const fullName = (ev.repo && ev.repo.name) || "";
      const isOwnRepo =
        fullName.toLowerCase().startsWith(GITHUB_USER + "/") ||
        repoMap.has(fullName.toLowerCase());
      if (!isOwnRepo) {
        continue;
      }
      const summary = summarizeEvent(ev);
      if (!summary) {
        continue;
      }
      const shortName = fullName.includes("/") ? fullName.split("/")[1] : fullName;
      const repoObj = repoMap.get(fullName.toLowerCase()) || repoMap.get(shortName.toLowerCase());
      const dest = repoObj
        ? resolveRepoDestination(repoObj)
        : { url: "https://github.com/" + fullName, kind: "repo" };
      coveredRepoNames.add(shortName.toLowerCase());

      items.push({
        type: "repo",
        date: formatIsoDate(ev.created_at),
        sortKey: String(ev.created_at || ""),
        title: shortName || fullName,
        url: dest.url,
        destKind: dest.kind,
        summary: summary
      });
    }

    // Supplement with recent repository push timestamps for repos not in recent events.
    const sortedByPush = state.repos.slice().sort((a, b) => {
      return String(b.pushed_at || "").localeCompare(String(a.pushed_at || ""));
    });
    const maxSupplemental = 10;
    let added = 0;
    for (let i = 0; i < sortedByPush.length && added < maxSupplemental; i += 1) {
      const repo = sortedByPush[i];
      const key = String(repo.name || "").toLowerCase();
      // Skip forks here so upstream fork timestamps are not shown as personal updates.
      if (repo.fork || coveredRepoNames.has(key)) {
        continue;
      }
      const dest = resolveRepoDestination(repo);
      items.push({
        type: "repo",
        date: formatIsoDate(repo.pushed_at || repo.updated_at),
        sortKey: String(repo.pushed_at || repo.updated_at || ""),
        title: repo.name,
        url: dest.url,
        destKind: dest.kind,
        summary: repo.description
          ? "updated repository — " + repo.description
          : "updated repository"
      });
      added += 1;
    }

    items.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
    return items;
  }

  function renderFeed() {
    const allItems = buildFeedItems();
    const filtered = allItems.filter((item) => {
      return state.feedFilter === "all" || item.type === state.feedFilter;
    });

    if (filtered.length === 0) {
      dom.feedList.innerHTML = '<p class="muted">No feed entries match this filter.</p>';
      dom.feedMoreWrap.hidden = true;
      return;
    }

    const visible = filtered.slice(0, state.feedLimit);
    const htmlParts = [];

    for (let i = 0; i < visible.length; i += 1) {
      const item = visible[i];
      if (item.type === "blog") {
        const tagText =
          item.tags.length > 0 ? ":" + item.tags.map(escapeHtml).join(":") + ":" : "";
        htmlParts.push(
          '<article class="feed-item">' +
            '<div class="feed-meta">' +
              '<span class="feed-date">' + escapeHtml(item.date) + "</span>" +
              '<span class="badge badge-blog">[BLOG]</span>' +
              (tagText ? '<span class="feed-tags">' + tagText + "</span>" : "") +
            "</div>" +
            '<h3 class="feed-title">' + escapeHtml(item.title) + "</h3>" +
            '<div class="feed-body">' + item.html + "</div>" +
          "</article>"
        );
      } else {
        htmlParts.push(
          '<article class="feed-item">' +
            '<div class="feed-meta">' +
              '<span class="feed-date">' + escapeHtml(item.date) + "</span>" +
              '<span class="badge badge-repo">[REPO]</span>' +
              '<span class="feed-tags">[' + escapeHtml(item.destKind) + "]</span>" +
            "</div>" +
            '<div class="feed-body">' +
              '<a class="repo-link" href="' + escapeHtml(item.url) + '" rel="noopener">' +
                escapeHtml(item.title) +
              "</a> " +
              "<span>" + escapeHtml(item.summary) + "</span>" +
            "</div>" +
          "</article>"
        );
      }
    }

    dom.feedList.innerHTML = htmlParts.join("");
    dom.feedMoreWrap.hidden = filtered.length <= state.feedLimit;
  }

  function sortRepos(repos) {
    const list = repos.slice();
    if (state.repoSort === "starred") {
      list.sort((a, b) => {
        const diff = (b.stargazers_count || 0) - (a.stargazers_count || 0);
        if (diff !== 0) {
          return diff;
        }
        return String(b.pushed_at || "").localeCompare(String(a.pushed_at || ""));
      });
    } else if (state.repoSort === "name") {
      list.sort((a, b) =>
        String(a.name || "").toLowerCase().localeCompare(String(b.name || "").toLowerCase())
      );
    } else {
      list.sort((a, b) =>
        String(b.pushed_at || b.updated_at || "").localeCompare(
          String(a.pushed_at || a.updated_at || "")
        )
      );
    }
    return list;
  }

  function renderRepos() {
    if (state.repos.length === 0) {
      dom.repoSummary.textContent =
        state.sourceMode === "unavailable"
          ? "Could not reach GitHub API (offline or rate-limited)."
          : "No public repositories found.";
      dom.repoTbody.innerHTML =
        '<tr><td colspan="4" class="muted">No repository data available.</td></tr>';
      return;
    }

    const sorted = sortRepos(state.repos);
    dom.repoSummary.textContent =
      "Showing " + sorted.length + " public repositories for " + GITHUB_USER + ".";

    const rows = [];
    for (let i = 0; i < sorted.length; i += 1) {
      const repo = sorted[i];
      const dest = resolveRepoDestination(repo);
      const stars = Number(repo.stargazers_count || 0);
      const updated = formatIsoDate(repo.pushed_at || repo.updated_at);
      const srcLink =
        dest.kind === "pages"
          ? ' <a class="repo-src-link" href="' +
            escapeHtml(repo.html_url) +
            '" rel="noopener" title="View source repository">[src]</a>'
          : "";
      const desc = repo.description
        ? '<div class="repo-desc">' + escapeHtml(repo.description) + "</div>"
        : "";

      rows.push(
        "<tr>" +
          "<td>" +
            '<div class="repo-name-row">' +
              '<a class="repo-link" href="' + escapeHtml(dest.url) + '" rel="noopener">' +
                escapeHtml(repo.name) +
              "</a>" +
              srcLink +
            "</div>" +
            desc +
          "</td>" +
          '<td class="col-dest">[' + escapeHtml(dest.kind) + "]</td>" +
          '<td class="col-num">' + stars + "</td>" +
          '<td class="col-date">' + escapeHtml(updated) + "</td>" +
        "</tr>"
      );
    }

    dom.repoTbody.innerHTML = rows.join("");
  }

  function updateStatusPill() {
    if (state.sourceMode === "live" || state.sourceMode === "cached (session)") {
      dom.status.textContent = "github: " + state.sourceMode + " (" + state.repos.length + " repos)";
    } else {
      dom.status.textContent = "github: " + state.sourceMode;
    }
  }

  function initTheme() {
    const STORAGE_KEY = "dleslie_theme";
    const modes = ["auto", "light", "dark"];
    let current = "auto";
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (modes.includes(saved)) {
        current = saved;
      }
    } catch (_err) {
      // Ignore localStorage restrictions.
    }

    function apply(mode) {
      if (mode === "auto") {
        document.documentElement.removeAttribute("data-theme");
      } else {
        document.documentElement.setAttribute("data-theme", mode);
      }
      dom.themeToggle.textContent = "[theme: " + mode + "]";
    }

    apply(current);
    dom.themeToggle.addEventListener("click", () => {
      current = modes[(modes.indexOf(current) + 1) % modes.length];
      apply(current);
      try {
        localStorage.setItem(STORAGE_KEY, current);
      } catch (_err) {
        // Ignore localStorage restrictions.
      }
    });
  }

  function bindEvents() {
    for (let i = 0; i < dom.feedFilterBtns.length; i += 1) {
      dom.feedFilterBtns[i].addEventListener("click", function () {
        state.feedFilter = this.getAttribute("data-feed-filter");
        state.feedLimit = INITIAL_FEED_LIMIT;
        for (let j = 0; j < dom.feedFilterBtns.length; j += 1) {
          dom.feedFilterBtns[j].classList.toggle(
            "is-active",
            dom.feedFilterBtns[j] === this
          );
        }
        renderFeed();
      });
    }

    for (let i = 0; i < dom.repoSortBtns.length; i += 1) {
      dom.repoSortBtns[i].addEventListener("click", function () {
        state.repoSort = this.getAttribute("data-repo-sort");
        for (let j = 0; j < dom.repoSortBtns.length; j += 1) {
          dom.repoSortBtns[j].classList.toggle(
            "is-active",
            dom.repoSortBtns[j] === this
          );
        }
        renderRepos();
      });
    }

    dom.feedMoreBtn.addEventListener("click", () => {
      state.feedLimit += INITIAL_FEED_LIMIT;
      renderFeed();
    });
  }

  async function init() {
    initTheme();
    bindEvents();
    await loadBlogPosts();
    renderFeed();
    await loadGitHubData();
    updateStatusPill();
    renderFeed();
    renderRepos();
  }

  init();
})();
