// global variables declaration

/**
 * Extracts the Wikipedia language code from a URL, supporting mobile hosts
 * like `en.m.wikipedia.org`.
 * @param {string} url URL to parse.
 * @returns {string} Language code, or "en" fallback.
 */
function getWikiLanguageFromUrl(url) {
    try {
        var parsedUrl = new URL(url, window.location.origin);
        var hostParts = (parsedUrl.hostname || "").toLowerCase().split(".").filter(Boolean);
        var wikipediaIndex = hostParts.indexOf("wikipedia");

        if (wikipediaIndex > 0) {
            // Mobile host shape: <lang>.m.wikipedia.org
            if (hostParts[wikipediaIndex - 1] === "m" && wikipediaIndex - 2 >= 0) {
                return hostParts[wikipediaIndex - 2];
            }
            return hostParts[0];
        }
    } catch (e) {
        // Fall through to regex fallback.
    }

    var match = String(url).match(/^https?:\/\/([a-z-]+)(?:\.m)?\.wikipedia\./i);
    if (match && match[1]) {
        return match[1].toLowerCase();
    }

    return "en";
}

// get current wikipedia language
var g_wikiLang = getWikiLanguageFromUrl(window.location.href);
console.log(g_wikiLang);

// initialize
var g_onlyUnderline = true

// set to true to troubleshoot headline key matching on tricky titles.
var g_debugHeadline = false

// reduce request pressure on mobile browsers to improve reliability.
var g_isMobileBrowser = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
var g_sparqlBinSize = g_isMobileBrowser ? 2000 : 4500;
var g_mediaWikiBinSize = g_isMobileBrowser ? 25 : 45;
var g_apiConcurrency = g_isMobileBrowser ? 2 : 8;

// initialize
var g_FromLinkNametoSitelinks = new Object();

// initialize
var g_missingDataLinksArr = [];

// initialize
var g_redirectDict = new Object();






// takes a number as input and returns the corresponding color as HEX
/**
 * Maps a sitelink count to a predefined HEX color bucket.
 * @param {number} n Sitelink count.
 * @returns {string|undefined} HEX color string for supported ranges.
 */
function getColorOfNumber(n) {
    const colors = ["#0000FF", "#E6CC00", "#A420FC", "#CC5500", "#00C400", "#DC2367"]
    if (n < 10) { return colors[0] }
    if (n < 25) { return colors[1] }
    if (n < 50) { return colors[2] }
    if (n < 100) { return colors[3] }
    if (n < 150) { return colors[4] }
    if (n >= 150) { return colors[5] }
}

// transforms URL to Linktitle
/**
 * Normalizes a Wikipedia page title string for dictionary lookups.
 * Decodes percent-encoding (when valid), replaces spaces with underscores,
 * and normalizes Unicode to NFC form.
 * @param {string} title Raw title value.
 * @returns {string} Normalized title, or an empty string for non-string input.
 */
function normalizeWikiTitle(title) {
    if (typeof title !== "string") {
        return "";
    }

    var normalizedTitle = title;
    try {
        normalizedTitle = decodeURIComponent(normalizedTitle);
    } catch (e) {
        // Keep the original title if decoding fails for malformed input.
    }

    return normalizedTitle.replace(/ /g, "_").normalize("NFC");
}

/**
 * Extracts a normalized Wikipedia title from a URL.
 * Supports `/wiki/<title>` paths and `?title=<title>` query parameters.
 * Falls back to string parsing if URL parsing fails.
 * @param {string} url Link URL (absolute or relative).
 * @returns {string} Normalized article title.
 */
function transformURL(url) {
    try {
        var parsedUrl = new URL(url, window.location.href);
        var path = parsedUrl.pathname || "";

        if (path.startsWith("/wiki/")) {
            return normalizeWikiTitle(path.substring("/wiki/".length));
        }

        var titleParam = parsedUrl.searchParams.get("title");
        if (titleParam) {
            return normalizeWikiTitle(titleParam);
        }
    } catch (e) {
        // Fall through to simple parsing.
    }

    var intermediateURL = url.replace(/^https?:\/\/[^/]+\/wiki\//, "");
    return normalizeWikiTitle(intermediateURL.split("#")[0].split("?")[0]);

}

/**
 * Writes headline matching diagnostics when debug mode is enabled.
 * @param {string} message Log message.
 * @param {*} [data=null] Optional structured data to log alongside the message.
 * @returns {void}
 */
function debugHeadlineLog(message, data = null) {
    if (!g_debugHeadline) {
        return;
    }

    if (data === null) {
        console.log("[WikiLinkColor][headline] " + message);
    } else {
        console.log("[WikiLinkColor][headline] " + message, data);
    }
}

/**
 * Returns the best available headline element for the current article page.
 * @returns {HTMLElement|null} Headline element if found, otherwise null.
 */
function getHeadlineElement() {
    return document.getElementById("firstHeading")
        || document.querySelector("h1.mw-first-heading")
        || document.querySelector("main h1")
        || document.querySelector("h1");
}

/**
 * Resolves sitelink information for a title using direct and redirect lookups.
 * @param {string} title Article title to resolve.
 * @returns {{value:number,source:string,key:string,redirectTarget?:string}|null}
 * Resolution payload when found, otherwise null.
 */
function getSitelinksForTitle(title) {
    var normalizedTitle = normalizeWikiTitle(title);

    if (g_FromLinkNametoSitelinks.hasOwnProperty(normalizedTitle)) {
        return {
            value: g_FromLinkNametoSitelinks[normalizedTitle],
            source: "direct",
            key: normalizedTitle
        };
    }

    if (g_redirectDict.hasOwnProperty(normalizedTitle)) {
        var redirectTarget = g_redirectDict[normalizedTitle];
        if (g_FromLinkNametoSitelinks.hasOwnProperty(redirectTarget)) {
            return {
                value: g_FromLinkNametoSitelinks[redirectTarget],
                source: "redirect",
                key: normalizedTitle,
                redirectTarget: redirectTarget
            };
        }
    }

    return null;
}

/**
 * Escapes a value for safe inclusion in a SPARQL string literal.
 * @param {*} value Value to escape.
 * @returns {string} Escaped string literal content.
 */
function escapeSparqlLiteral(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Encodes a normalized Wikipedia title for use in SPARQL-generated wiki paths.
 * @param {string} title Raw title.
 * @returns {string} URI-encoded title path segment.
 */
function encodeWikiTitleForSparqlPath(title) {
    try {
        return encodeURI(normalizeWikiTitle(title)).replace(/'/g, "%27");
    } catch (e) {
        return normalizeWikiTitle(title);
    }
}
/**
 * Determines whether a link should be processed for coloring.
 * Filters out non-Wikipedia, meta/special/help pages, and edit/history actions.
 * @param {string} url Link URL.
 * @returns {boolean} True when the link is an eligible article link.
 */
function checkIfLinkIsWorth(url) {
    var parsedUrl;
    try {
        parsedUrl = new URL(url, window.location.origin);
    } catch (e) {
        return false;
    }

    if (getWikiLanguageFromUrl(parsedUrl.href) !== g_wikiLang) {
        return false
    }
    if (parsedUrl.href.toLowerCase().includes("wikipedia:")) {
        return false
    }
    if (parsedUrl.href.toLowerCase().includes("special:")) {
        return false
    }
    if (parsedUrl.href.toLowerCase().includes("help:")) {
        return false
    }

    var actionParam = (parsedUrl.searchParams.get("action") || "").toLowerCase();
    if (actionParam === "edit" || actionParam === "history") {
        return false
    }

    return true
}

/**
 * Applies either underline styling or text color based on configuration.
 * @param {HTMLAnchorElement} link Link element to style.
 * @param {string} color HEX color value.
 * @returns {void}
 */
function applyColorToLink(link,color) {
    if (g_onlyUnderline) {
        // Mobile Wikipedia styles can suppress default text decorations.
        // Use !important to enforce a single underline.
        link.style.setProperty("text-decoration-line", "underline", "important");
        link.style.setProperty("text-decoration-color", color, "important");
        link.style.setProperty("text-decoration-thickness", "2px", "important");
        link.style.setProperty("text-decoration-style", "solid", "important");
        link.style.setProperty("text-underline-offset", "0.08em", "important");
    }
    else {
        link.style.color = color;
    }
}

/**
 * Removes custom underline styling from a link.
 * @param {HTMLAnchorElement} link Link element to reset.
 * @returns {void}
 */
function removeUnderline(link) {
    link.style.setProperty("text-decoration-line", "none", "important");
    link.style.removeProperty("text-decoration-color");
    link.style.removeProperty("text-decoration-thickness");
    link.style.removeProperty("text-decoration-style");
    link.style.removeProperty("text-underline-offset");
}

/**
 * Applies a colored box treatment to the page headline.
 * @param {HTMLElement} headlineElement Headline element to style.
 * @param {string} color HEX color value.
 * @returns {void}
 */
function applyColorBoxToHeadline(headlineElement, color) {
    headlineElement.style.textDecoration = "none";
    headlineElement.style.border = "3px solid " + color;
    headlineElement.style.borderRadius = "6px";
    headlineElement.style.padding = "0.2em 0.4em";
    headlineElement.style.display = "inline-block";
}

/**
 * Checks whether a link points to the current page and should remain unstyled.
 * @param {HTMLAnchorElement} link Link element to evaluate.
 * @returns {boolean} True for same-page links (including in-page anchors).
 */
function shouldRemoveUnderlineForCurrentPageLink(link) {
    if (!link || !link.href) {
        return false;
    }

    var currentPage = new URL(window.location.href);
    var linkUrl = new URL(link.href, window.location.origin);

    // Keep direct self-links and in-page anchors (sections, citations, reference back-links) unstyled.
    if (currentPage.origin === linkUrl.origin && currentPage.pathname === linkUrl.pathname) {
        return true;
    }

    return false;
}

/**
 * Queries Wikidata SPARQL for sitelink counts of provided Wikipedia titles.
 * Populates `g_FromLinkNametoSitelinks` with normalized title -> sitelink count.
 * @param {string} s VALUES fragment containing quoted title tokens.
 * @param {string} [lang="en"] Wikipedia language code.
 * @returns {Promise<void>}
 */
async function SPARQLAPI(s, lang = "en") {
    console.log("SPARQL API called with the following:");
    console.log(s);

    // set up the wikidata API and define parameters
    var querystring = `prefix schema: <http://schema.org/>
    SELECT ?shorturl ?longurl ?sitelinks WHERE {
        VALUES ?shorturl {`+ s + `}
        BIND(IRI(CONCAT("https://` + lang + `.wikipedia.org/wiki/",?shorturl)) AS ?longurl)
        ?longurl schema:about ?item.
        ?longurl schema:inLanguage "` + lang + `" .
        ?longurl schema:isPartOf <https://` + lang + `.wikipedia.org/>.
        ?item wikibase:sitelinks ?sitelinks
              }
 `

    const myHeaders = {}
    const myUrl = "https://query.wikidata.org/sparql?"

    // wait for response
    const response = await fetch(myUrl + new URLSearchParams({ format: 'json', query: querystring }).toString(), { headers: new Headers(myHeaders) });
    console.log(response);
    const data = await response.json();

    // feed sitelinksDict with information
    for (let i = 0; i < data["results"]["bindings"].length; i++) {
        var shortUrl = normalizeWikiTitle(data["results"]["bindings"][i]["shorturl"]["value"]);
        g_FromLinkNametoSitelinks[shortUrl] = Number(data["results"]["bindings"][i]["sitelinks"]["value"]);
    }
}

/**
 * Splits API input into bins and executes the provided async API function in parallel.
 * Supports chunking by item count or by accumulated string length.
 * @param {(payload:string, lang:string) => Promise<void>} APIFunction Async API function.
 * @param {string[]} stringArr Input title/token array.
 * @param {string} separatorLeft Prefix separator applied per token.
 * @param {string} separatorRight Suffix separator applied per token.
 * @param {"numberOfItems"|"stringSize"} numberOfItemsOrStringSize Chunking strategy.
 * @param {number} binSize Maximum items or approximate max string size per bin.
 * @param {number} [maxConcurrency=Infinity] Maximum number of concurrent requests.
 * @returns {Promise<void>}
 */
async function runAPIinBins(APIFunction, stringArr, separatorLeft, separatorRight, numberOfItemsOrStringSize, binSize, maxConcurrency = Infinity) {

    stringArr = [...stringArr];
    var tasks = [];

    if (numberOfItemsOrStringSize == "numberOfItems") {
        for (let i = 0; i < stringArr.length; i += binSize) {
            var tempArr = stringArr.slice(i, i + binSize);
            if (tempArr.length === 0) {
                continue;
            }
            console.log("This is tempArr");
            console.log(tempArr);

            var s = tempArr.reduce((current, next) => current + separatorLeft + next + separatorRight, "");
            console.log("This is s");
            console.log(s);
            tasks.push(() => APIFunction(s, g_wikiLang));
        }
    }
    if (numberOfItemsOrStringSize == "stringSize") {
        while (stringArr.length > 0) {
            var element = "";
            while (stringArr.length > 0 && element.length < binSize) {
                var appendy = stringArr.shift();
                if (appendy === undefined || appendy === null || appendy === "") {
                    continue;
                }
                element += separatorLeft + appendy + separatorRight;
            }
            if (element.length > 0) {
                tasks.push(() => APIFunction(element, g_wikiLang));
            }
        }
    }

    var concurrency = Math.max(1, Number(maxConcurrency) || 1);
    var nextTaskIndex = 0;

    async function worker() {
        while (nextTaskIndex < tasks.length) {
            var currentIndex = nextTaskIndex;
            nextTaskIndex += 1;
            await tasks[currentIndex]();
        }
    }

    var workers = [];
    for (let i = 0; i < Math.min(concurrency, tasks.length); i++) {
        workers.push(worker());
    }

    await Promise.all(workers);
}



/**
 * Queries the MediaWiki API for redirect resolution of page titles.
 * Populates `g_redirectDict` with normalized redirect source -> target mappings.
 * @param {string} s Pipe-delimited title list (leading `|` expected).
 * @param {string} [lang="en"] Wikipedia language code.
 * @returns {Promise<void>}
 */
async function MediaWikiAPI(s, lang = "en") {

    console.log("MediaWikiAPI is called with the following string");
    console.log(s);

    if (s.length == 0) {
        return
    }

    // remove first "|"
    s = s.substring(1);


    // run the API and extract result to JSON
    const endpoint = "https://" + lang + ".wikipedia.org/w/api.php?";
    const myURLsearch = new URLSearchParams({ action: "query", prop: "pageprops", format: "json", redirects: true, titles: s });
    var result = await fetch(endpoint + myURLsearch.toString());
    var jsonResult = await result.json();

    console.log("This is the JSON Result");
    console.log(jsonResult);

 
    const pageArray = Object.entries(jsonResult["query"]["pages"])

    // feed redirectDict with retrieved data
    if (jsonResult.hasOwnProperty("query")) {
        if (jsonResult["query"].hasOwnProperty("redirects")) {
            for (let i = 0; i < jsonResult["query"]["redirects"].length; i++) {
                var fromTitle = normalizeWikiTitle(jsonResult["query"]["redirects"][i]["from"]);
                var toTitle = normalizeWikiTitle(jsonResult["query"]["redirects"][i]["to"]);
                g_redirectDict[fromTitle] = toTitle;
            }
        }
    }
}



/**
 * Orchestrates link collection, API enrichment, and link/headline coloring.
 * Updates link styling in-place across the current document and applies
 * a color box to the article headline when sitelink data is available.
 * @returns {Promise<void>}
 */
async function main() {

    // get all links as HTMLCollection and transform it to an array
    var links = document.getElementsByTagName("a");
    var arr = Array.from(links);

    // filter the array
    arr = arr.filter(link => checkIfLinkIsWorth(link.href))
    arr = arr.filter(link => link.href.includes("wikipedia"));
    arr = arr.filter(link => !link.href.toLowerCase().includes("wikipedia:"));
    arr = arr.filter(link => !link.href.toLowerCase().includes("portal:"));
    arr = arr.filter(link => !link.href.toLowerCase().includes("category:"));
    arr = arr.filter(link => !link.href.toLowerCase().includes("help:"));
    arr = arr.filter(link => !link.href.toLowerCase().includes("template:"));
    arr = arr.filter(link => !link.href.toLowerCase().includes("special:"));

    // filter out main page and other navigation pages
    arr = arr.filter(link => !link.href.toLowerCase().includes("/wiki/main_page"));
    arr = arr.filter(link => !link.href.toLowerCase().includes("/wiki/contents"));

    // filter out desktop navigation links; mobile layouts reuse some class names
    // for real content containers, so skip this filter on mobile browsers.
    arr = arr.filter(link => {
        if (g_isMobileBrowser) {
            return true;
        }
        const parent = link.closest('.mw-sidebar, #mw-panel, .vector-menu-portal, .vector-pinnable-container');
        return !parent;
    });

    // create an array of strings
    var stringArr = arr.map(link => link.href);
    console.log("Here is string array:::")
    console.log(stringArr)

    // filter out # in order to prevent BadRequests (currently under observation)
    // stringArr = stringArr.filter(link => !link.toLowerCase().includes("#"));

    // remove duplicates
    stringArr = [...new Set(stringArr)];

    // obtain the title names
    stringArr = stringArr.map(s => transformURL(s))
    stringArr.push(transformURL(window.location.href));
    stringArr = [...new Set(stringArr)].filter(Boolean);




    console.log("this is the titlename array");
    console.log(stringArr);

    // run only unresolved items through the SPARQL API (global caches persist across reruns)
    var unresolvedTitles = stringArr.filter(title =>
        !g_FromLinkNametoSitelinks.hasOwnProperty(title) && !g_redirectDict.hasOwnProperty(title)
    );

    var sparqlArr = unresolvedTitles.map(s => encodeWikiTitleForSparqlPath(s));
    if (sparqlArr.length > 0) {
        await runAPIinBins(SPARQLAPI, sparqlArr, '"', '" ', "stringSize", g_sparqlBinSize, g_apiConcurrency);
    }


    // run all items through the MediaWiki - API, splitted in bins of 50 because of request length limitations
    // while (stringArr.length != 0) {
    //     var element = ""
    //     var testArray = []
    //     while (element.length < 450) {
    //         var appendy = stringArr.shift()
    //         element += "|" + appendy
    //         testArray.push(appendy)
    //     }

    //     await callMediaWiki(element,g_wikiLang);
    // }

    // initialize the list of wikidataentries we want to run through the SPARQL API
    // var wikidataEntryList = Object.values(g_FromLinknameToWikidata);



    console.log("this is stringArr");
    console.log(stringArr);

    console.log("this is FromLinkNameToSitelinks");
    console.log(g_FromLinkNametoSitelinks);
    // check which links needed to get checked again because of redirects
    var uniqueTitles = new Set();
    for (let i = 0; i < links.length; i++) {
        if (!checkIfLinkIsWorth(links[i].href)) {
            continue;
        }

        // get link title
        var linkTitle = transformURL(links[i].href);

        if (!(g_FromLinkNametoSitelinks.hasOwnProperty(linkTitle)) && stringArr.includes(linkTitle)) {
            uniqueTitles.add(linkTitle);
        }

    }

    g_missingDataLinksArr = Array.from(uniqueTitles);

    console.log("These are the missing links");
    console.log(g_missingDataLinksArr);

    // run MediaWikiAPI to get redirections
    if (g_missingDataLinksArr.length > 0) {
        await runAPIinBins(MediaWikiAPI, g_missingDataLinksArr, "|", "", "numberOfItems", g_mediaWikiBinSize, g_apiConcurrency);
    }

    console.log("This is redirectDict");
    console.log(g_redirectDict);

    // run SPARQL API again on redirected
    var newSPARQLList = Object.values(g_redirectDict)
        .filter(title => !g_FromLinkNametoSitelinks.hasOwnProperty(title))
        .map(s => encodeWikiTitleForSparqlPath(s));
    if (newSPARQLList.length > 0) {
        await runAPIinBins(SPARQLAPI, newSPARQLList, '"', '" ', "stringSize", g_sparqlBinSize, g_apiConcurrency);
    }

    // merge new results with SPARQL API result

    //  finally, color the links according to their sitelinks
    for (let i = 0; i < links.length; i++) {
        if (links[i].href) {
            if (!checkIfLinkIsWorth(links[i].href)) {
                removeUnderline(links[i]);
                continue;
            }

            if (shouldRemoveUnderlineForCurrentPageLink(links[i])) {
                removeUnderline(links[i]);
                continue;
            }

            // get link title
            var linkTitle = transformURL(links[i].href);

            if (g_FromLinkNametoSitelinks.hasOwnProperty(linkTitle)) {
                applyColorToLink(links[i],getColorOfNumber(g_FromLinkNametoSitelinks[linkTitle]));
            }
            else if (g_redirectDict.hasOwnProperty(linkTitle)) {
                applyColorToLink(links[i],getColorOfNumber(g_FromLinkNametoSitelinks[g_redirectDict[linkTitle]]));
            }
            else {
                removeUnderline(links[i]);
            }
        }
    }

    // underline the article headline in the corresponding color
    var currentPageTitle = transformURL(window.location.href);
    var headlineElement = getHeadlineElement();

    debugHeadlineLog("Current title", currentPageTitle);
    debugHeadlineLog("Headline element found", headlineElement ? (headlineElement.id || headlineElement.className || headlineElement.tagName) : "none");

    if (headlineElement) {
        var headlineSitelinks = getSitelinksForTitle(currentPageTitle);

        // Fallback: explicitly query current page title if it did not resolve in bulk calls.
        if (!headlineSitelinks) {
            debugHeadlineLog("No initial match for headline title; running direct lookup.");
            await MediaWikiAPI("|" + currentPageTitle, g_wikiLang);

            var redirectTarget = g_redirectDict[currentPageTitle] || currentPageTitle;
            var encodedRedirectTarget = encodeWikiTitleForSparqlPath(redirectTarget);
            await SPARQLAPI('"' + escapeSparqlLiteral(encodedRedirectTarget) + '" ', g_wikiLang);
            headlineSitelinks = getSitelinksForTitle(currentPageTitle);
        }

        if (headlineSitelinks) {
            debugHeadlineLog("Matched headline title", headlineSitelinks);
            var headlineColor = getColorOfNumber(headlineSitelinks.value);
            applyColorBoxToHeadline(headlineElement, headlineColor);
        } else {
            debugHeadlineLog("Failed to match headline title after fallback", currentPageTitle);
        }
    }

}


var g_mainIsRunning = false;
var g_mainPendingRun = false;

/**
 * Runs main with overlap protection; if called while running, queues one rerun.
 * @returns {Promise<void>}
 */
async function runMainSafely() {
    if (g_mainIsRunning) {
        g_mainPendingRun = true;
        return;
    }

    g_mainIsRunning = true;
    try {
        await main();
    } catch (e) {
        console.error("[WikiLinkColor] main() failed:", e);
    } finally {
        g_mainIsRunning = false;
        if (g_mainPendingRun) {
            g_mainPendingRun = false;
            setTimeout(runMainSafely, 100);
        }
    }
}

/**
 * Schedules initial and follow-up runs to handle mobile content hydration.
 * @returns {void}
 */
function scheduleRuns() {
    runMainSafely();
    setTimeout(runMainSafely, 1200);
    setTimeout(runMainSafely, 4000);
    setTimeout(runMainSafely, 9000);

    if (document.body && typeof MutationObserver !== "undefined") {
        var observerDebounce = null;
        var observer = new MutationObserver(() => {
            clearTimeout(observerDebounce);
            observerDebounce = setTimeout(runMainSafely, 700);
        });

        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => observer.disconnect(), 15000);
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleRuns, { once: true });
} else {
    scheduleRuns();
}
