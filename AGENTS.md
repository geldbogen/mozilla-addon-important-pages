# Repository Guidelines

## Project Structure & Module Organization

This repository contains a small Firefox extension that colors Wikipedia links and article headings according to Wikidata sitelink counts.

- `go.js` handles Wikipedia links, title normalization, API queries, redirects, and styling. `wikivoyage.js` colors numbered English Wikivoyage **See** listing names. `colors.js` provides their shared color tiers.
- `manifest.json` defines the Manifest V3 extension, Wikipedia URL matches, permissions, version, and Firefox extension ID.
- `README.md` explains the color tiers using externally hosted screenshots.
- `tests/` contains browser regression fixtures. ZIP distribution artifacts are ignored by `.gitignore`. Source files remain at the repository root.

## Build, Test, and Development Commands

There is no package manager configuration, build pipeline, or dependency installation step. Edit the root files directly.

- `node --check go.js` (also `colors.js` and `wikivoyage.js`): check JavaScript syntax if Node.js is installed; this does not execute browser APIs.
- `python3 -m json.tool manifest.json > /dev/null`: validate manifest JSON syntax if Python 3 is installed.
- For local development, open Firefox’s `about:debugging#/runtime/this-firefox`, select **Load Temporary Add-on**, and choose `manifest.json`. Reload the extension after edits, then refresh the Wikipedia page.

## Coding Style & Naming Conventions

Use four-space indentation in JavaScript and two-space indentation in JSON. Follow adjacent code for punctuation and quote style; no formatter or linter is configured. Use descriptive camelCase helper names, preserve existing `g_` global names, and document nontrivial helpers with JSDoc. Route title comparisons through `normalizeWikiTitle()` and URL extraction through `transformURL()`.

## Testing Guidelines

Run `python3 -m http.server 8000` and open `http://localhost:8000/tests/wikivoyage.html` for dependency-free DOM regression checks with mocked APIs. There is no coverage threshold. Also check Firefox on English/non-English Wikipedia articles, redirects, encoded/Unicode titles, self-links, anchors, and navigation links. Verify Palermo's Wikivoyage listing colors and inspect API failures. Include reproduction URLs and results in the pull request.

## Commit & Pull Request Guidelines

Recent commits use short, imperative descriptions such as `Fix navigation links being incorrectly underlined` and `Refactor URL transformation and enhance headline matching logic`. Keep commits focused. Pull requests should describe the behavior change, link relevant issues, record validation, and include before/after screenshots for styling changes.

## Configuration & Permissions

Keep API endpoint changes consistent with `manifest.json`. Review permission changes carefully, preserve the Firefox extension ID, and change the version only for an intended release.
