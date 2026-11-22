// Open wikivoyage.html through a local HTTP server to run against a real DOM.
(async function () {
    var fixture = document.getElementById("fixture");
    var results = document.getElementById("results");
    var requests;
    var failures = 0;

    function assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }

    function listing(name, itemId, extra = "", numbered = true) {
        return `<li><bdi class="vcard">
            ${numbered ? '<a class="mw-kartographer-maplink" href="#/maplink/3">1</a>' : ""}
            <span class="listing-name"><a href="https://example.org/">${name}</a></span>
            ${itemId ? `<span id="${itemId}" class="noprint"></span>` : ""}
            <span class="listing-content">Description <a href="https://example.org/info">info</a></span>
            ${extra}</bdi></li>`;
    }

    function mount(html) {
        fixture.innerHTML = `<div class="mw-parser-output">Unrelated banner content</div>
            <div id="mw-content-text"><div class="mw-parser-output">${html}</div></div>`;
        requests = [];
    }

    function mockFetch(handler) {
        window.fetch = async function (url) {
            requests.push(new URL(url));
            return handler(new URL(url));
        };
    }

    function counts(items) {
        return { ok: true, json: async () => ({ results: { bindings: Object.entries(items).map(([id, n]) => ({
            item: { value: "http://www.wikidata.org/entity/" + id }, sitelinks: { value: String(n) }
        })) } }) };
    }

    async function test(name, run) {
        var result = document.createElement("li");
        try {
            await run();
            result.className = "pass";
            result.textContent = "PASS: " + name;
        } catch (error) {
            failures++;
            result.className = "fail";
            result.textContent = "FAIL: " + name + " — " + error.message;
        }
        results.append(result);
    }

    await test("All six tiers retain Wikipedia's existing boundaries", async () => {
        var cases = [[0, "#0000FF"], [9, "#0000FF"], [10, "#E6CC00"], [24, "#E6CC00"],
            [25, "#A420FC"], [49, "#A420FC"], [50, "#CC5500"], [99, "#CC5500"],
            [100, "#00C400"], [149, "#00C400"], [150, "#DC2367"], [200, "#DC2367"]];
        for (var [count, expected] of cases) {
            assert(getColorOfNumber(count) === expected, "Wrong tier for " + count);
        }
    });

    await test("Modern parser: only numbered See listings and subsections are collected", async () => {
        mount(`<h2 id="Get_in">Get in</h2>${listing("Airport", "Q1")}
            <section><div class="mw-heading"><h2 id="See">See</h2></div>
            <ul>${listing("Palermo Cathedral", "Q1478407")}${listing("No marker", "Q2", "", false)}</ul>
            <section><h3>Museums</h3><ul>${listing("Museum", "Q3")}</ul></section></section>
            <h2 id="Do">Do</h2>${listing("Activity", "Q4")}`);
        var entries = getWikivoyageSeeListings();
        assert(entries.map(entry => entry.itemId).join(",") === "Q1478407,Q3", "Section or marker filtering failed");
    });

    await test("Legacy parser: nested See anchor and plain-text listing names work", async () => {
        mount('<h2><span class="mw-headline" id="See">See</span></h2><ul>' +
            listing("Plain name", "Q1").replace('<a href="https://example.org/">Plain name</a>', "Plain name") +
            '</ul><h2><span id="Eat">Eat</span></h2>' + listing("Restaurant", "Q2"));
        mockFetch(() => counts({ Q1: 100 }));
        await colorWikivoyageSeeListings();
        var names = fixture.querySelectorAll(".listing-name");
        assert(names[0].style.color === "rgb(0, 196, 0)", "Plain name not colored");
        assert(names[1].style.color === "", "Restaurant changed");
    });

    await test("Direct Wikidata sister links and item markers identify the attraction", async () => {
        mount('<h2 id="See">See</h2><ul>' + listing("Cathedral", null,
            '<span class="listing-sister-wikidata"><a href="/wiki/d:Q1478407">Wikidata</a></span>') +
            listing("Chapel", null, '<span class="listing-sister-wikidata"><a href="https://www.wikidata.org/wiki/Q1034853">Wikidata</a></span>') +
            listing("Bad item", "Q0") + '</ul>');
        var entries = getWikivoyageSeeListings();
        assert(entries[0].itemId === "Q1478407" && entries[1].itemId === "Q1034853", "Item links not resolved");
        assert(entries[2].itemId === null, "Invalid item accepted");
    });

    await test("Wikipedia references handle interwiki, language, Unicode and encoded titles", async () => {
        var cases = [["/wiki/w:Palermo_Cathedral", "en", "Palermo Cathedral"],
            ["/wiki/w:de:K%C3%B6lner_Dom", "de", "Kölner Dom"],
            ["https://fr.wikipedia.org/wiki/Cath%C3%A9drale_de_Palerme#Histoire", "fr", "Cathédrale de Palerme"],
            ["https://en.m.wikipedia.org/w/index.php?title=Palermo_Cathedral", "en", "Palermo Cathedral"]];
        for (var [href, lang, title] of cases) {
            mount(listing("Reference", null, `<span class="listing-sister-wikipedia"><a href="${href}">Wikipedia</a></span>`));
            var page = getWikivoyageWikipediaPage(fixture.querySelector(".vcard"));
            assert(page && page.lang === lang && page.title === title, "Wrong reference: " + href);
        }
        for (var href of ["https://example.org/wiki/w:Fake", "/wiki/w:%ZZ", "javascript:alert(1)"]) {
            mount(listing("Invalid", null, `<span class="listing-sister-wikipedia"><a href="${href}">Wikipedia</a></span>`));
            assert(getWikivoyageWikipediaPage(fixture.querySelector(".vcard")) === null, "Invalid reference accepted");
        }
    });

    await test("Wikipedia-only references follow normalization and redirects before coloring", async () => {
        mount('<h2 id="See">See</h2>' + listing("Display name", null,
            '<span class="listing-sister-wikipedia"><a href="/wiki/w:palermo_Cathedral">Wikipedia</a></span>'));
        mockFetch(url => {
            if (url.hostname === "en.wikipedia.org") {
                assert(url.searchParams.get("origin") === "*", "Cross-origin fallback missing");
                return { ok: true, json: async () => ({ query: {
                    normalized: [{ from: "palermo Cathedral", to: "Palermo Cathedral" }],
                    redirects: [{ from: "Palermo Cathedral", to: "Cathedral of Palermo" }],
                    pages: { 1: { title: "Cathedral of Palermo", pageprops: { wikibase_item: "Q1478407" } } }
                } }) };
            }
            assert(url.searchParams.get("query").includes("wd:Q1478407"), "Wrong item queried");
            return counts({ Q1478407: 35 });
        });
        await colorWikivoyageSeeListings();
        var name = fixture.querySelector(".listing-name");
        assert(name.style.color === "rgb(164, 32, 252)" && name.querySelector("a").style.color === name.style.color, "Linked name not colored");
        assert(fixture.querySelector(".listing-content a").style.color === "", "Description link changed");
        assert(fixture.querySelector(".mw-kartographer-maplink").style.color === "", "Map marker changed");
    });

    await test("Direct IDs take priority, duplicate IDs are queried once, and zero is valid", async () => {
        mount('<h2 id="See">See</h2>' + listing("First", "Q1",
            '<span class="listing-sister-wikipedia"><a href="/wiki/w:Other">Wikipedia</a></span>') + listing("Duplicate", "Q1"));
        mockFetch(() => counts({ Q1: 0 }));
        await colorWikivoyageSeeListings();
        assert(requests.length === 1 && requests[0].hostname === "query.wikidata.org", "Unnecessary lookups");
        assert(requests[0].searchParams.get("query").match(/wd:Q1\b/g).length === 1, "Duplicate IDs queried");
        assert([...fixture.querySelectorAll(".listing-name")].every(name => name.style.color === "rgb(0, 0, 255)"), "Zero count not colored");
    });

    await test("Missing identities, missing counts and malformed counts preserve existing styles", async () => {
        mount('<h2 id="See">See</h2>' + listing("Missing identity", null) + listing("Missing count", "Q1") + listing("Malformed count", "Q2"));
        fixture.querySelectorAll(".listing-name").forEach(name => { name.style.color = "red"; });
        mockFetch(() => counts({ Q2: "invalid" }));
        await colorWikivoyageSeeListings();
        assert([...fixture.querySelectorAll(".listing-name")].every(name => name.style.color === "red"), "Unresolved style changed");
    });

    await test("Empty/non-See pages send no requests", async () => {
        mount('<h2 id="Eat">Eat</h2>' + listing("Restaurant", "Q1"));
        mockFetch(() => { throw new Error("Unexpected fetch"); });
        await colorWikivoyageSeeListings();
        assert(requests.length === 0, "Lookup on unsupported page");
    });

    await test("A failed 50-item batch does not prevent later listings from coloring", async () => {
        mount('<h2 id="See">See</h2>' + Array.from({ length: 51 }, (_, i) => listing("Place " + i, "Q" + (i + 1))).join(""));
        mockFetch(url => url.searchParams.get("query").includes("wd:Q51 ")
            ? counts({ Q51: 150 }) : { ok: false, status: 503 });
        await colorWikivoyageSeeListings();
        var names = fixture.querySelectorAll(".listing-name");
        assert(requests.length === 2, "Wrong batch count");
        assert(names[0].style.color === "" && names[50].style.color === "rgb(220, 35, 103)", "Failure isolation failed");
    });

    await test("Wikipedia fallback failures leave entries unchanged without blocking known IDs", async () => {
        mount('<h2 id="See">See</h2>' + listing("Known", "Q1") + listing("Unavailable", null,
            '<span class="listing-sister-wikipedia"><a href="/wiki/w:Unavailable">Wikipedia</a></span>'));
        mockFetch(url => {
            if (url.hostname === "en.wikipedia.org") {
                throw new Error("Offline");
            }
            return counts({ Q1: 50 });
        });
        await colorWikivoyageSeeListings();
        var names = fixture.querySelectorAll(".listing-name");
        assert(names[0].style.color === "rgb(204, 85, 0)" && names[1].style.color === "", "Fallback failure blocked known item");
    });

    fixture.innerHTML = "";
    document.title = failures ? failures + " checks failed" : "All " + results.children.length + " checks passed";
    document.body.dataset.testResult = failures ? "failed" : "passed";
    var summary = document.createElement("p");
    summary.textContent = document.title;
    results.after(summary);
})();
