/**
 * Reads a listing's explicit Wikidata identity without guessing from its name.
 * @param {HTMLElement} listing Listing container.
 * @returns {string|null} Validated Wikidata item ID.
 */
function getWikivoyageItemId(listing) {
    var link = listing.querySelector(".listing-sister-wikidata a");
    if (link) {
        var url = new URL(link.href, window.location.origin);
        if (url.hostname === window.location.hostname) {
            var interwiki = url.pathname.match(/^\/wiki\/d:(Q[1-9]\d*)$/);
            if (interwiki) {
                return interwiki[1];
            }
        }
        if (url.hostname === "www.wikidata.org" || url.hostname === "wikidata.org") {
            var item = url.pathname.match(/^\/wiki\/(Q[1-9]\d*)$/);
            if (item) {
                return item[1];
            }
        }
    }

    var name = listing.querySelector(".listing-name");
    var itemMarker = name && name.nextElementSibling;
    return itemMarker && /^Q[1-9]\d*$/.test(itemMarker.id) ? itemMarker.id : null;
}

/**
 * Reads the Wikipedia sister link, including Wikivoyage's w: interwiki URLs.
 * @param {HTMLElement} listing Listing container.
 * @returns {{lang:string,title:string}|null} Explicit Wikipedia article reference.
 */
function getWikivoyageWikipediaPage(listing) {
    var link = listing.querySelector(".listing-sister-wikipedia a");
    if (!link) {
        return null;
    }

    try {
        var url = new URL(link.href, window.location.origin);
        if (!/^https?:$/.test(url.protocol)) {
            return null;
        }
        var title = url.pathname.startsWith("/wiki/")
            ? decodeURIComponent(url.pathname.substring(6))
            : url.searchParams.get("title");
        var wikipedia = url.hostname.match(/^([a-z][a-z0-9-]*)\.(?:m\.)?wikipedia\.org$/);
        var lang;
        if (wikipedia) {
            lang = wikipedia[1];
        } else if (url.hostname === window.location.hostname && title && title.startsWith("w:")) {
            title = title.substring(2);
            var languagePrefix = title.match(/^([a-z][a-z0-9-]*):/);
            lang = languagePrefix ? languagePrefix[1] : "en";
            if (languagePrefix) {
                title = title.substring(languagePrefix[0].length);
            }
        }
        return lang && title ? { lang: lang, title: title.replace(/_/g, " ").normalize("NFC") } : null;
    } catch (e) {
        return null;
    }
}

/**
 * Collects numbered listings beneath See, including subsections and both parsers.
 * @returns {Array<{name:HTMLElement,itemId:string|null,page:object|null}>} Listings.
 */
function getWikivoyageSeeListings() {
    var content = document.getElementById("mw-content-text");
    if (!content) {
        return [];
    }

    var inSee = false;
    var listings = [];
    for (var element of content.querySelectorAll("h2, .vcard")) {
        if (element.tagName === "H2") {
            inSee = element.id === "See" || !!element.querySelector("#See");
            continue;
        }
        var name = element.querySelector(".listing-name");
        var marker = element.querySelector(".mw-kartographer-maplink");
        if (inSee && name && marker && /^\d+$/.test(marker.textContent.trim())) {
            listings.push({
                name: name,
                itemId: getWikivoyageItemId(element),
                page: getWikivoyageWikipediaPage(element)
            });
        }
    }
    return listings;
}

/**
 * Resolves Wikipedia-only listings to items, following normalized titles/redirects.
 * A failed batch leaves those listings unchanged while other batches can proceed.
 * @param {Array} listings Collected listings (itemId is populated in place).
 * @returns {Promise<void>}
 */
async function resolveWikivoyageWikipediaPages(listings) {
    var languages = new Set(listings.filter(entry => !entry.itemId && entry.page).map(entry => entry.page.lang));
    for (var lang of languages) {
        var entries = listings.filter(entry => !entry.itemId && entry.page && entry.page.lang === lang);
        var titles = [...new Set(entries.map(entry => entry.page.title))];
        for (var offset = 0; offset < titles.length; offset += 50) {
            var batch = titles.slice(offset, offset + 50);
            try {
                var params = new URLSearchParams({
                    action: "query", prop: "pageprops", ppprop: "wikibase_item",
                    redirects: "1", format: "json", origin: "*", titles: batch.join("|")
                });
                var response = await fetch("https://" + lang + ".wikipedia.org/w/api.php?" + params);
                if (!response.ok) {
                    throw new Error("Wikipedia lookup HTTP " + response.status);
                }
                var data = await response.json();
                if (!data.query) {
                    throw new Error("Wikipedia lookup returned no query data");
                }
                var aliases = new Map([...(data.query.normalized || []), ...(data.query.redirects || [])]
                    .map(alias => [alias.from, alias.to]));
                var items = new Map(Object.values(data.query.pages || {})
                    .map(page => [page.title, page.pageprops && page.pageprops.wikibase_item]));
                for (var entry of entries.filter(entry => batch.includes(entry.page.title))) {
                    var title = entry.page.title;
                    var visited = new Set();
                    while (aliases.has(title) && !visited.has(title)) {
                        visited.add(title);
                        title = aliases.get(title);
                    }
                    var itemId = items.get(title);
                    if (/^Q[1-9]\d*$/.test(itemId)) {
                        entry.itemId = itemId;
                    }
                }
            } catch (error) {
                console.warn("[WikiLinkColor][Wikivoyage] Wikipedia lookup failed", error);
            }
        }
    }
}

/**
 * Colors See listing names with the same wikibase:sitelinks metric and tiers as
 * Wikipedia. Explicit item IDs avoid mismatches between display and article names.
 * @returns {Promise<void>}
 */
async function colorWikivoyageSeeListings() {
    var listings = getWikivoyageSeeListings();
    await resolveWikivoyageWikipediaPages(listings);
    var itemIds = [...new Set(listings.map(entry => entry.itemId).filter(Boolean))];
    for (var offset = 0; offset < itemIds.length; offset += 50) {
        var batch = itemIds.slice(offset, offset + 50);
        try {
            var query = `PREFIX wd: <http://www.wikidata.org/entity/>
                PREFIX wikibase: <http://wikiba.se/ontology#>
                SELECT ?item ?sitelinks WHERE {
                    VALUES ?item { ${batch.map(id => "wd:" + id).join(" ")} }
                    ?item wikibase:sitelinks ?sitelinks .
                }`;
            var params = new URLSearchParams({ format: "json", query: query });
            var response = await fetch("https://query.wikidata.org/sparql?" + params);
            if (!response.ok) {
                throw new Error("Wikidata lookup HTTP " + response.status);
            }
            var data = await response.json();
            var counts = new Map();
            for (var binding of data.results.bindings) {
                var itemId = binding.item.value.split("/").pop();
                var value = binding.sitelinks.value;
                if (/^\d+$/.test(value)) {
                    counts.set(itemId, Number(value));
                }
            }
            for (var entry of listings) {
                if (counts.has(entry.itemId)) {
                    var color = getColorOfNumber(counts.get(entry.itemId));
                    entry.name.style.color = color;
                    for (var link of entry.name.querySelectorAll("a")) {
                        link.style.color = color;
                    }
                }
            }
        } catch (error) {
            console.warn("[WikiLinkColor][Wikivoyage] Sitelink lookup failed", error);
        }
    }
}

colorWikivoyageSeeListings();
