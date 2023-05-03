
// takes a number as input and returns the corresponding color as HEX
function getColorOfNumber(n) {
    const colors =["#0000FF","#E6CC00","#A420FC","#CC5500", "#00C400", "#DC2367"]
    if (n<10) { return colors[0]}
    if (n<25) { return colors[1]}
    if (n<50) { return colors[2]}
    if (n<100) { return colors[3]}
    if (n<150) { return colors[4]}
    if (n>=150) { return colors[5]}
}

// initialize empty dictionary for the famous score/number of languagelinks of each link 
var sitelinksDict = new Object();



async function feedDict(s) {
    
    // set up the wikidata API and define parameters
    var querystring= `prefix schema: <http://schema.org/>
    SELECT ?url ?sitelinks WHERE {
        VALUES ?url {`+ s + `}
        ?url schema:about ?item.
        ?item wikibase:sitelinks ?sitelinks
    } `

    const myHeaders = {"User-Agent":"coloring wikipedialinks firefox addon /1.0 (juliusniemeyer1995@gmail.com) javascript","mode" : "no-cors"}
    const myUrl = "https://query.wikidata.org/sparql?"

    // wait for response
    const response = await fetch(myUrl + new URLSearchParams({format: 'json', query: querystring}).toString(),{headers: new Headers(myHeaders)});
    console.log(response)
    const data = await response.json();

    // feed sitelinksDict with information
    for (let i = 0; i < data["results"]["bindings"].length; i++) {
        sitelinksDict[data["results"]["bindings"][i]["url"]["value"]] = Number(data["results"]["bindings"][i]["sitelinks"]["value"]);  
    }

    }

async function main() {

    // get all links as HTMLCollection and transform it to an array
    var links =document.getElementsByTagName("a");
    var arr = Array.from(links);
    
    // filter the array
    arr = arr.filter(link => link.href.includes("wikipedia"));
    arr = arr.filter(link => !link.href.toLowerCase().includes("wikipedia:"));
    arr = arr.filter(link => !link.href.toLowerCase().includes("portal:"));
    arr = arr.filter(link => !link.href.toLowerCase().includes("category:"));
    arr = arr.filter(link => !link.href.toLowerCase().includes("help:"));   
    // arr = arr.filter(link => !link.href.toLowerCase().includes("#"));   

    // create an array of strings
    var stringArr = arr.map(link => link.href); 

    // remove duplicates
    stringArr = [...new Set(stringArr)];


    // run all items through the API but splitted in bins of 40 items because limitations of request length
    while (stringArr.length != 0) {
        var element = ""
        while (element.length < 4500) {
            element+="<" + stringArr.shift() + "> "
        }
        await feedDict(element);        
    }
    //  color the links according to their sitelinks
    for (let i = 0; i < links.length; i++) {
        if (links[i].href) 
        {
            if (sitelinksDict.hasOwnProperty(links[i].href)) {
                links[i].style.color=getColorOfNumber(sitelinksDict[links[i].href]);
                }
            else {
                links[i].style.color="#808080"
            }
        }        
    }

}


main();