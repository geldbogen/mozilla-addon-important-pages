console.log("hello world")

var url = "https://en.wikipedia.org/w/api.php"; 

var params = {
    action: "query",
    titles: "Albert Einstein",
    prop: "langlinks",
    format: "json"
};

url = url + "?origin=*";

// Object.keys(params)
fetch(url)
.then(function(response) {
    return response.json
})
.then(function(response) {
    console.log(response)
})