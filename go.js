
var counter =0
// takes a number as input and returns the corresponding color as HEX
function getColorOfNumber(n) {
    const colors =["#0000FF","#EED202","#A420FC","#FFA500", "#00C400", "#DC2367"]
    counter+=1
    console.log(counter) 
    console.log("called")
    n = BigInt(n);
    console.log(typeof(n));
    if (n<10) { return colors[0]}
    if (n<25) { return colors[1]}
    if (n<50) { return colors[2]}
    if (n<100) { return colors[3]}
    if (n<150) { return colors[4]}
    if (n>=150) { return colors[5]}
}

// initialize empty dictionary for the famous score of each link 
var sitelinksDict = new Object();

function listenForClicks() {
    document.addEventListener("click",colorgo);
}

async function feedDict(arr) {
    
    // set up the wikidata API and define parameters
    const gigastring = arr.reduce((all, current) => all +"<" +current + "> ","");
    var querystring= `prefix schema: <http://schema.org/>
    SELECT ?url ?sitelinks WHERE {
        VALUES ?url {`+ gigastring + `}
        ?url schema:about ?item.
        ?item wikibase:sitelinks ?sitelinks
    } `

    const myHeaders = {"User-Agent":"coloring wikipedialinks firefox addon /1.0 (juliusniemeyer1995@gmail.com) javascript","mode" : "no-cors"}
    const myUrl = "https://query.wikidata.org/sparql?"

    // wait for response
    const response = await fetch(myUrl + new URLSearchParams({format: 'json', query: querystring}).toString(),{headers: new Headers(myHeaders)});
    const data = await response.json();
    console.log(data)

    // feed sitelinksDict with informations
    for (let i = 0; i < data["results"]["bindings"].length; i++) {
        sitelinksDict[data["results"]["bindings"][i]["url"]["value"]] = Number(data["results"]["bindings"][i]["sitelinks"]["value"]);  
    }

    }

async function colorgo(e) {
    var links =document.getElementsByTagName("a");
    var arr = Array.from(links);
    arr = arr.filter(link => link.href.includes("wikipedia"));
    arr = arr.filter(link => !link.href.toLowerCase().includes("wikipedia:"));
    arr = arr.filter(link => !link.href.toLowerCase().includes("portal:"));
    arr = arr.filter(link => !link.href.toLowerCase().includes("category:"));
    arr = arr.filter(link => !link.href.toLowerCase().includes("help:"));   
    var stringArr = arr.map(link => link.href); 
    stringArr = [...new Set(stringArr)];

    // run all items through the API but splitted in bins of 50 items because limitations of request length
    for (let i = 0; i < (stringArr.length)/50; i++) {
        const element = stringArr.slice(50*i,50*(i+1));
        var bla = await feedDict(element);
        console.log(i);
        
    }
    console.log("sitelinks dict");
    console.log(sitelinksDict);
    
    console.log("dict length " + sitelinksDict.size)
    console.log("links length " + links.length)

    //  color the links according to their sitelinks
    for (let i = 0; i < links.length; i++) {
        if (links[i].href && sitelinksDict.hasOwnProperty(links[i].href)) 
        {
            links[i].style.color=getColorOfNumber(sitelinksDict[links[i].href]);
            // links[i].style.color="#D35400";
            
            // console.log(links[i].href)
        }        
    }


}


colorgo("a");