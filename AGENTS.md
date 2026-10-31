# Repository Guidelines

## Project Structure & Module Organization

This repository contains a small Firefox extension that colors Wikipedia links and article headings according to Wikidata sitelink counts.

- `go.js` is the sole content script. It collects links, normalizes titles, queries Wikidata and MediaWiki, resolves redirects, and applies styling.
- `manifest.json` defines the Manifest V3 extension, Wikipedia URL matches, permissions, version, and Firefox extension ID.
- `README.md` explains the color tiers using externally hosted screenshots.
- ZIP archives are distribution artifacts and are ignored by `.gitignore`. There are no separate source, asset, or test directories.

## Build, Test, and Development Commands

There is no package manager configuration, build pipeline, or dependency installation step. Edit the root files directly.

- `node --check go.js`: check JavaScript syntax if Node.js is installed; this does not execute browser APIs.
- `python3 -m json.tool manifest.json > /dev/null`: validate manifest JSON syntax if Python 3 is installed.
- For local development, open Firefox’s `about:debugging#/runtime/this-firefox`, select **Load Temporary Add-on**, and choose `manifest.json`. Reload the extension after edits, then refresh the Wikipedia page.

## Coding Style & Naming Conventions

Use four-space indentation in JavaScript and two-space indentation in JSON. Follow adjacent code for punctuation and quote style; no formatter or linter is configured. Use descriptive camelCase helper names, preserve existing `g_` global names, and document nontrivial helpers with JSDoc. Route title comparisons through `normalizeWikiTitle()` and URL extraction through `transformURL()`.

## Testing Guidelines

There is no automated test framework or coverage threshold. Perform manual Firefox checks on English and non-English articles, redirects, percent-encoded titles, Unicode titles, self-links, section anchors, and navigation links. Verify link colors and headline borders, and inspect console output and API failures. Include reproduction URLs and observed results in the pull request.

## Commit & Pull Request Guidelines

Recent commits use short, imperative descriptions such as `Fix navigation links being incorrectly underlined` and `Refactor URL transformation and enhance headline matching logic`. Keep commits focused. Pull requests should describe the behavior change, link relevant issues, record validation, and include before/after screenshots for styling changes.

## Configuration & Permissions

Keep API endpoint changes consistent with `manifest.json`. Review permission changes carefully, preserve the Firefox extension ID, and change the version only for an intended release.
