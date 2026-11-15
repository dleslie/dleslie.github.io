;;; export-org.el --- Export blog.org top-level entries to JSON and JS -*- lexical-binding: t; -*-

;;; Commentary:
;; Run via: emacs -Q --batch --script scripts/export-org.el
;; Reads blog.org in the current directory and writes data/posts.json and data/posts.js.

;;; Code:

(require 'cl-lib)
(require 'subr-x)
(require 'org)
(require 'ox-html)
(require 'json)

(defconst export-org-input-file "blog.org")
(defconst export-org-json-file "data/posts.json")
(defconst export-org-js-file "data/posts.js")

(defun export-org--slugify (text)
  "Convert TEXT into a lowercase URL-safe slug."
  (let* ((lower (downcase (or text "")))
         (clean (replace-regexp-in-string "[^a-z0-9]+" "-" lower))
         (trimmed (replace-regexp-in-string "\\`-+\\|-+\\'" "" clean)))
    (if (string-empty-p trimmed) "post" trimmed)))

(defun export-org--extract-date (pom)
  "Extract YYYY-MM-DD date string from heading at POM, or nil."
  (let ((prop-date (org-entry-get pom "DATE"))
        (closed (org-entry-get pom "CLOSED"))
        (raw nil))
    (setq raw (or prop-date closed))
    (unless raw
      (save-excursion
        (goto-char pom)
        (let ((end (save-excursion (org-end-of-subtree t t))))
          (when (re-search-forward
                 "[[<]\\([0-9]\\{4\\}-[0-9]\\{2\\}-[0-9]\\{2\\}\\)[^]>]*[]>]\\|\\b\\([0-9]\\{4\\}-[0-9]\\{2\\}-[0-9]\\{2\\}\\)\\b"
                 end t)
            (setq raw (or (match-string 1) (match-string 2)))))))
    (when (and raw (string-match "\\([0-9]\\{4\\}-[0-9]\\{2\\}-[0-9]\\{2\\}\\)" raw))
      (match-string 1 raw))))

(defun export-org--subtree-body ()
  "Return the raw org body of the current heading, excluding heading line and drawers."
  (save-excursion
    (org-back-to-heading t)
    (let ((start (progn (forward-line 1) (point)))
          (end (save-excursion (org-end-of-subtree t t))))
      (goto-char start)
      ;; Skip planning line (SCHEDULED/DEADLINE/CLOSED) if present.
      (when (looking-at-p org-planning-line-re)
        (forward-line 1))
      ;; Skip :PROPERTIES: ... :END: drawer if present.
      (when (looking-at-p "^[ \t]*:PROPERTIES:[ \t]*$")
        (when (re-search-forward "^[ \t]*:END:[ \t]*$" end t)
          (forward-line 1)))
      (string-trim (buffer-substring-no-properties (point) end)))))

(defun export-org--render-html (org-body)
  "Export ORG-BODY string to an HTML fragment."
  (if (string-empty-p org-body)
      ""
    (let ((org-html-htmlize-output-type nil)
          (org-export-with-toc nil)
          (org-export-with-section-numbers nil)
          (org-export-with-sub-superscripts nil)
          (org-export-preserve-breaks nil))
      (string-trim
       (org-export-string-as org-body 'html t
                             '(:with-toc nil
                               :section-numbers nil
                               :with-sub-superscripts nil))))))

(defun export-org-run ()
  "Parse `export-org-input-file' and write JSON and JS outputs."
  (unless (file-exists-p export-org-input-file)
    (error "Missing input file: %s" export-org-input-file))
  (make-directory (file-name-directory export-org-json-file) t)
  (let ((posts '()))
    (with-temp-buffer
      (insert-file-contents export-org-input-file)
      (org-mode)
      (goto-char (point-min))
      (org-map-entries
       (lambda ()
         (let* ((level (org-current-level))
                (todo (org-get-todo-state))
                (tags (cl-remove-if (lambda (tag) (member tag '("draft" "noexport")))
                                    (org-get-tags nil t)))
                (all-tags (org-get-tags nil t)))
           (when (and (= level 1)
                      (not (member todo '("DRAFT" "TODO")))
                      (not (member "draft" all-tags))
                      (not (member "noexport" all-tags)))
             (let* ((title (org-get-heading t t t t))
                    (date (or (export-org--extract-date (point))
                              (format-time-string "%Y-%m-%d")))
                    (custom-id (org-entry-get (point) "CUSTOM_ID"))
                    (id (or custom-id (format "%s-%s" date (export-org--slugify title))))
                    (body (export-org--subtree-body))
                    (html (export-org--render-html body)))
               (push `((id . ,id)
                       (title . ,title)
                       (date . ,date)
                       (tags . ,(vconcat tags))
                       (html . ,html))
                     posts)))))
       nil nil))
    ;; Sort newest first by date string (ISO-8601).
    (setq posts (sort posts (lambda (a b)
                              (string> (alist-get 'date a)
                                       (alist-get 'date b)))))
    (let* ((json-encoding-pretty-print t)
           (json-str (json-encode (vconcat posts))))
      (with-temp-file export-org-json-file
        (insert json-str "\n"))
      (with-temp-file export-org-js-file
        (insert "// Generated from blog.org by scripts/export-org.el — do not edit manually.\n")
        (insert "window.__BLOG_POSTS__ = " json-str ";\n")))
    (message "Exported %d post(s) from %s" (length posts) export-org-input-file)))

(export-org-run)

;;; export-org.el ends here
