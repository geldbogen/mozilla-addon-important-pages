
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

// initialize empty dictionary for the famous score/number of languagelinks of each link 
var g_fromWikidataToSitelinks = new Object();


// intialize
var g_FromLinknameToWikidata = new Object();

// prefix schema: <http://schema.org/>
//     SELECT ?shorturl ?longurl ?item ?sitelinks WHERE {
//         VALUES ?shorturl {<Gulf_War>}
//         BIND(CONCAT(<https://en.wikipedia.org/wiki/>,?shorturl) AS ?longurl)
//       ?longurl schema:about ?item.
//       ?item wikibase:sitelinks ?sitelinks.
//     }


async function callSPARQLfromString(s) {

    // set up the wikidata API and define parameters
    var querystring = `prefix schema: <http://schema.org/>
    SELECT ?item ?sitelinks WHERE {
        VALUES ?url {`+ s + `}
        ?item wikibase:sitelinks ?sitelinks
    } `

    const myHeaders = { "User-Agent": "coloring wikipedialinks firefox addon /1.0 (juliusniemeyer1995@gmail.com) javascript", "mode": "no-cors" }
    const myUrl = "https://query.wikidata.org/sparql?"

    // wait for response
    const response = await fetch(myUrl + new URLSearchParams({ format: 'json', query: querystring }).toString(), { headers: new Headers(myHeaders) });
    const data = await response.json();

    // feed sitelinksDict with information
    for (let i = 0; i < data["results"]["bindings"].length; i++) {
        g_fromWikidataToSitelinks[data["results"]["bindings"][i]["item"]["value"]] = Number(data["results"]["bindings"][i]["sitelinks"]["value"]);
    }

}
async function callMediaWiki(s) {

    // initialize a ditionary which translates from the linkname to the official wikipedia page 
    var redirectDict = new Object();

    // run the API and extract result to JSON
    const endpoint = "https://en.wikipedia.org/w/api.php?";
    const myURLsearch = new URLSearchParams({ action: "query", prop: "pageprops", format: "json", ppprop: "wikibase_item", redirects: true, titles: s });
    var result = await fetch(endpoint + myURLsearch.toString());
    var jsonResult = await result.json();
    
    console.log("This is the JSON Result");
    console.log(jsonResult);


    const pageArray = Object.entries(jsonResult["query"]["pages"])

    // feed the global dictionary g_dictFromLinknameToWikidata with the obtained data from the API
    for (let i = 0; i < pageArray.length; i++) {
        try {
            var wikidataEntry = pageArray[i][1]["pageprops"]["wikibase_item"];
            g_FromLinknameToWikidata[pageArray[i][1]["title"]] = "wd:" + wikidataEntry;
        }
        catch {

        }
    }


    if (jsonResult.hasOwnProperty("query") & jsonResult["query"].hasOwnProperty["redirects"]) {
        // feed redirectDictReverse with redirects
        for (let i = 0; i < jsonResult["query"]["redirects"].length; i++) {
            redirectDict[jsonResult["query"]["redirects"][i]["from"]] = jsonResult["query"]["redirects"][i]["to"];

        }
        // utilize the redirect dict to feed g_dictFromLinknameToWikidata with more data
        for (const key of Object.keys(redirectDict)) {
            if (!g_FromLinknameToWikidata.hasOwnProperty(key)) {
                g_FromLinknameToWikidata[key] = g_FromLinknameToWikidata[redirectDict[key]];
            }
        }
    }
    console.log("This is from linkname to wikidata");
    console.log(g_FromLinknameToWikidata);
}




async function main() {

    // get all links as HTMLCollection and transform it to an array
    var links = document.getElementsByTagName("a");
    var arr = Array.from(links);

    // filter the array
    arr = arr.filter(link => link.href.includes("wikipedia"));
    arr = arr.filter(link => !link.href.toLowerCase().includes("wikipedia:"));
    arr = arr.filter(link => !link.href.toLowerCase().includes("portal:"));
    arr = arr.filter(link => !link.href.toLowerCase().includes("category:"));
    arr = arr.filter(link => !link.href.toLowerCase().includes("help:"));
    arr = arr.filter(link => !link.href.toLowerCase().includes("template:"));
    arr = arr.filter(link => !link.href.toLowerCase().includes("special:"));

    // create an array of strings
    var stringArr = arr.map(link => link.href);
    var stringArrCopy = stringArr
    console.log("Here is string array:::")
    console.log(stringArr)

    // filter out # in order to prevent BadRequests (currently under observation)
    stringArr = stringArr.filter(link => !link.toLowerCase().includes("#"));

    // remove duplicates
    stringArr = [...new Set(stringArr)];

    // obtain the title names
    stringArr = stringArr.map(s => s.replace("https://en.wikipedia.org/wiki/", ""))
    console.log("this is the titlename array");
    console.log(stringArr);

    // run all items through the MediaWiki - API, splitted in bins of 50 because of request length limitations
    while (stringArr.length != 0) {
        var element = ""
        var testArray = []
        while (element.length < 450) {
            var appendy = stringArr.shift()
            element += "|" + appendy
            testArray.push(appendy)
        }
        
        await callMediaWiki(element);
    }

    // initialize the list of wikidataentries we want to run through the SPARQL API
    var wikidataEntryList = Object.values(g_FromLinknameToWikidata);


    // run all items through the SPARQL - API, splitted in bins because of request length limitations
    while (wikidataEntryList.length != 0) {
        var element = ""
        var testArray = []
        while (element.length < 4500) {
            var appendy = wikidataEntryList.shift()
            element += appendy + ""
            testArray.push(appendy)
        }
        await callSPARQLfromString(element);
    }
    //  color the links according to their sitelinks
    for (let i = 0; i < links.length; i++) {
        if (links[i].href) {

            var linkTitle = links[i].href.remove("https://en.wikipedia.org/wiki/", "")

            if (g_FromLinknameToWikidata.hasOwnProperty(linkTitle)) {
                links[i].style.color = getColorOfNumber(g_fromWikidataToSitelinks[g_FromLinknameToWikidata[linkTitle]]);
            }
            else {
                if (stringArrCopy.includes(links[i].href))
                    links[i].style.color = "#808080"
            }
        }
    }

}


main();