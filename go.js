
// takes a number as input and returns the corresponding color as HEX
function getColorOfNumber(n) {
    const colors =["#0000FF","#F1C40F","#7D3C98",  "#D35400", "#7B241C", "#DC2367"]
    switch (n) {
        case n<10:
            return colors[0];            
        case n>=10 && n<25:
            return colors[1];
        case n>=25 && n<50:
            return colors[2];
        case n>=50 && n<100:
            return colors[3];
        case n>=100 && n<150:
            return colors[4];
        case n>=150:
            return colors[5];
    }
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

    //  color the links according to their sitelinks
    for (let i = 0; i < links.length; i++) {
        if (links[i].href && sitelinksDict.hasOwnProperty(links[i].href)) 
        {
            links[i].style.color=getColorOfNumber(sitelinksDict[links[i].href]);
            // console.log(links[i].href)
        }        
    }


}


colorgo("a");