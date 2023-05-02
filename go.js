console.log("hello world")

var url = "https://en.wikipedia.org/w/api.php"; 

var params = {
    action: "query",
    titles: "Albert Einstein",
    prop: "langlinks",
    format: "json",
    lllimit: 500
};

url = url + "?origin=*";

// Object.keys(params)
// fetch(url)
// .then(function(response) {
//     return response.json
// })
// .then(function(response) {
//     console.log(response)
// })

function listenForClicks() {
    document.addEventListener("click",colorgo)
}
function colorgo(e) {
    var links =document.getElementsByTagName("a");
    for (let i = 0; i < links.length; i++) {
        if (links[i].href) 
        {
            links[i].style.color="#00FF00";
            console.log(links[i].href)
        }       
    }
    
}
function getNumberOfLanguages(url) {
    
}

colorgo("a");