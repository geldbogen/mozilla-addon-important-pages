// global variables declaration

// get current wikipedia language
var wikiUrl = window.location.href;
wikiUrl = wikiUrl.split(".wikipedia")[0];
wikiUrl = wikiUrl.replace("https://", "");
var g_wikiLang = wikiUrl
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
        var parsedUrl = new URL(url, window.location.origin);
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

    if (!parsedUrl.href.split("wikipedia")[0].includes(g_wikiLang)) {
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
        link.style.textDecoration = "underline";
        link.style.textDecorationColor = color;
        link.style.textDecorationThickness = "2px";
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
    link.style.textDecoration = "none";
    link.style.textDecorationColor = "";
    link.style.textDecorationThickness = "";
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
        for (let i = 0; i < (stringArr.length / binSize) + 1; i++) {
            var tempArr = stringArr.slice(i * binSize, (i + 1) * binSize);
            console.log("This is tempArr");
            console.log(tempArr);

            var s = tempArr.reduce((current, next) => current + separatorLeft + next + separatorRight, "");
            console.log("This is s");
            console.log(s);
            tasks.push(() => APIFunction(s, g_wikiLang));
        }
    }
    if (numberOfItemsOrStringSize == "stringSize") {
        while (stringArr.length != 0) {
            var element = ""
            while (element.length < binSize) {
                var appendy = stringArr.shift();
                element += separatorLeft + appendy + separatorRight;
            }
            tasks.push(() => APIFunction(element, g_wikiLang));
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

    // filter out navigation links based on parent element classes
    arr = arr.filter(link => {
        const parent = link.closest('.mw-sidebar, .vector-menu-portal, .vector-pinnable-container, .mw-portlet');
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




    console.log("this is the titlename array");
    console.log(stringArr);

    // run all items through the SPARQL - API, splitted in bins because of request length limitations

    var sparqlArr = stringArr.map(s => encodeWikiTitleForSparqlPath(s));
    await runAPIinBins(SPARQLAPI, sparqlArr, '"', '" ', "stringSize", g_sparqlBinSize, g_apiConcurrency);


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

        if (!(g_FromLinkNametoSitelinks.hasOwnProperty(linkTitle)) & stringArr.includes(linkTitle)) {
            uniqueTitles.add(linkTitle);
        }

    }

    g_missingDataLinksArr = Array.from(uniqueTitles);

    console.log("These are the missing links");
    console.log(g_missingDataLinksArr);

    // run MediaWikiAPI to get redirections
    await runAPIinBins(MediaWikiAPI, g_missingDataLinksArr, "|", "", "numberOfItems", g_mediaWikiBinSize, g_apiConcurrency);

    console.log("This is redirectDict");
    console.log(g_redirectDict);

    // run SPARQL API again on redirected
    var newSPARQLList = Object.values(g_redirectDict).map(s => encodeWikiTitleForSparqlPath(s));
    await runAPIinBins(SPARQLAPI, newSPARQLList, '"', '" ', "stringSize", g_sparqlBinSize, g_apiConcurrency);

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


main();
