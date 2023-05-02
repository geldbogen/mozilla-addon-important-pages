console.log("hello world")

var url = "https://en.wikipedia.org/w/api.php"; 

var params = {
    action: "query",
    titles: "Albert Einstein",
    prop: "langlinks",
    format: "json",
    lllimit: 500
};

var gigastring = ``


url = url + "?origin=*";

// Object.keys(params)


function listenForClicks() {
    document.addEventListener("click",colorgo);
}
function colorgo(e) {
    var links =document.getElementsByTagName("a");
    var arr = Array.from(links);
    const gigastring = arr.reduce((all, current) => all +"<" +current.href + "> ","");

    var querystring= `prefix schema: <http://schema.org/>
    SELECT ?url ?sitelinks WHERE {
    VALUES ?url {`+ gigastring + `}
    ?url schema:about ?item.
    ?item wikibase:sitelinks ?sitelinks
    } `

    fetch(url)
    .then(function(response) {
    return response.json
    })
    .then(function(response) {

    console.log(response);
    
    })
    .catch(function(error){console.log(error);});
    // for (let i = 0; i < links.length; i++) {
    //     if (links[i].href) 
    //     {
    //         links[i].style.color="#00FF00";
    //         console.log(links[i].href)
    //     }        
    // }


}
function getNumberOfLanguages(url) {

}

colorgo("a");