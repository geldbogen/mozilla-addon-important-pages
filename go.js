// global variables declaration

// get current wikipedia language
var wikiUrl = window.location.href;
wikiUrl = wikiUrl.split(".wikipedia")[0];
wikiUrl = wikiUrl.replace("https://", "");
var g_wikiLang = wikiUrl
console.log(g_wikiLang);

// initialize
var g_onlyUnderline = true

// initialize
var g_FromLinkNametoSitelinks = new Object();

// initialize
var g_missingDataLinksArr = [];

// initialize
var g_redirectDict = new Object();






// takes a number as input and returns the corresponding color as HEX
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
function transformURL(url) {
    var intermediateURL = url.replace("https://" + g_wikiLang + ".wikipedia.org/wiki/", "");
    return intermediateURL.split("#")[0];

}
function checkIfLinkIsWorth(url) {
    if (!url.split("wikipedia")[0].includes(g_wikiLang)) {
        return false
    }
    if (url.toLowerCase().includes("wikipedia:")) {
        return false
    }
    if (url.toLowerCase().includes("special:")) {
        return false
    }

    return true
}

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

async function SPARQLAPI(s, lang = "en") {
    console.log("SPARQL API called with the following:");
    console.log(s);

    // set up the wikidata API and define parameters
    var querystring = `prefix schema: <http://schema.org/>
    SELECT ?shorturl ?longurl ?sitelinks WHERE {
        VALUES ?shorturl {`+ s + `}
      BIND(IRI(CONCAT("https://` + lang + `.wikipedia.org/wiki/",?shorturl)) AS ?longurl)
      ?longurl schema:about ?item.
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
        g_FromLinkNametoSitelinks[data["results"]["bindings"][i]["shorturl"]["value"]] = Number(data["results"]["bindings"][i]["sitelinks"]["value"]);
    }
}

async function runAPIinBins(APIFunction, stringArr, separatorLeft, separatorRight, numberOfItemsOrStringSize, binSize) {

    stringArr = [...stringArr];

    if (numberOfItemsOrStringSize == "numberOfItems") {
        for (let i = 0; i < (stringArr.length / binSize) + 1; i++) {
            var tempArr = stringArr.slice(i * binSize, (i + 1) * binSize);
            console.log("This is tempArr");
            console.log(tempArr);

            var s = tempArr.reduce((current, next) => current + separatorLeft + next + separatorRight, "");
            console.log("This is s");
            console.log(s);
            await APIFunction(s, g_wikiLang)

        }
    }
    if (numberOfItemsOrStringSize == "stringSize") {
        while (stringArr.length != 0) {
            var element = ""
            while (element.length < binSize) {
                var appendy = stringArr.shift();
                element += separatorLeft + appendy + separatorRight;
            }
            await APIFunction(element, g_wikiLang);
        }
    }

}



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
                g_redirectDict[jsonResult["query"]["redirects"][i]["from"].replace(/ /g, "_")] = jsonResult["query"]["redirects"][i]["to"].replace(/ /g, "_");
            }
        }
    }
}



async function main() {

    // get all links as HTMLCollection and transform it to an array
    var links = document.getElementsByTagName("a");
    var arr = Array.from(links);

    // filter the array
    arr = arr.filter(link => checkIfLinkIsWorth(link.href))
    arr = arr.filter(link => link.href.includes("wikipedia"));
    // arr = arr.filter(link => !link.href.toLowerCase().includes("wikipedia:"));
    arr = arr.filter(link => !link.href.toLowerCase().includes("portal:"));
    arr = arr.filter(link => !link.href.toLowerCase().includes("category:"));
    arr = arr.filter(link => !link.href.toLowerCase().includes("help:"));
    arr = arr.filter(link => !link.href.toLowerCase().includes("template:"));
    // arr = arr.filter(link => !link.href.toLowerCase().includes("special:"));

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




    console.log("this is the titlename array");
    console.log(stringArr);

    // run all items through the SPARQL - API, splitted in bins because of request length limitations

    await runAPIinBins(SPARQLAPI, stringArr, '"', '" ', "stringSize", 4500);


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
    for (let i = 0; i < links.length; i++) {

        // get link title
        var linkTitle = transformURL(links[i].href);

        if (!(g_FromLinkNametoSitelinks.hasOwnProperty(linkTitle)) & stringArr.includes(linkTitle)) {
            g_missingDataLinksArr.push(linkTitle);
        }

    }

    console.log("These are the missing links");
    console.log(g_missingDataLinksArr);

    // run MediaWikiAPI to get redirections
    await runAPIinBins(MediaWikiAPI, g_missingDataLinksArr, "|", "", "numberOfItems", 45);

    console.log("This is redirectDict");
    console.log(g_redirectDict);

    // run SPARQL API again on redirected
    var newSPARQLList = Object.values(g_redirectDict);
    await runAPIinBins(SPARQLAPI, newSPARQLList, '"', '" ', "stringSize", 4500);

    // merge new results with SPARQL API result

    //  finally, color the links according to their sitelinks
    for (let i = 0; i < links.length; i++) {
        if (links[i].href) {

            // get link title
            var linkTitle = transformURL(links[i].href);

            if (g_FromLinkNametoSitelinks.hasOwnProperty(linkTitle)) {
                applyColorToLink(links[i],getColorOfNumber(g_FromLinkNametoSitelinks[linkTitle]));
            }
            else if (g_redirectDict.hasOwnProperty(linkTitle)) {
                applyColorToLink(links[i],getColorOfNumber(g_FromLinkNametoSitelinks[g_redirectDict[linkTitle]]));
            }
            else {
                applyColorToLink(links[i],"#808080");
            }
        }
    }

}


main();