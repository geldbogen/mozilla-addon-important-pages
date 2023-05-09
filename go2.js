console.log("This is go2");


const url = "";
const myLink = "https://en.wikipedia.org/wiki/Copenhagen";
const myLink2 = myLink.replace("https://en.wikipedia.org/wiki/", "");
const endpoint = "https://en.wikipedia.org/w/api.php?";

console.log("This is myLink2 " + myLink2);

const myURLsearch = new URLSearchParams({ action: "query", prop: "pageprops", format: "json", ppprop: "wikibase_item", redirects: true, titles: "Napoleon_I_of_France|Copenhagen|Airbus|GIE|Companies|İslahiye" });
const myHeaders = new Headers();
async function go() {
    var redirectDictReverse = new Object();
    var DictFromLinknameToWikidata = new Object();
    var result = await fetch(endpoint + myURLsearch.toString());
    var jsonResult = await result.json();
    console.log(jsonResult);
    console.log(jsonResult["query"]["redirects"]);    // this is an array
    for (let i = 0; i < jsonResult["query"]["redirects"].length; i++) {
        redirectDictReverse[jsonResult["query"]["redirects"][i]["to"]] = jsonResult["query"]["redirects"][i]["from"];

    }
    console.log("jsonResult")
    console.log(jsonResult["query"]["pages"])
    console.log(Object.entries(jsonResult["query"]["pages"]))
    const pageArray = Object.entries(jsonResult["query"]["pages"])
    for (let i=0;i<pageArray.length;i++) {
        console.log("hahaha");
        console.log(pageArray[i][1]);
        if (redirectDictReverse.hasOwnProperty(pageArray[i][1]["title"])) {
            var name = redirectDictReverse[pageArray[i][1]["title"]];
        }
        else {
            var name = pageArray[i][1]["title"];
        }
        DictFromLinknameToWikidata[name] = pageArray[i][1]["pageprops"]["wikibase_item"]
    }

    console.log(redirectDictReverse);
    console.log(jsonResult["query"]["pages"]);         // this is an Object 
    const linkcollectionHTML = document.getElementsByTagName("a");

    console.log(DictFromLinknameToWikidata);


}
go();
