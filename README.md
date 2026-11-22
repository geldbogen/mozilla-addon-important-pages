# mozilla-addon-important-pages

## Wikivoyage checkpoint

On English Wikivoyage, numbered listings under **See** (including its subsections)
now have their names colored using the same Wikidata sitelink counts and six color
tiers as Wikipedia. For example, **Palermo Cathedral** on
[Palermo](https://en.wikivoyage.org/wiki/Palermo#See) uses Wikidata item `Q1478407`.
Both linked names and plain-text names are supported. The listing's Wikidata item
is preferred; an explicit Wikipedia sister link is used as a fallback, including
redirect resolution. Entries without a usable reference or returned count retain
their existing appearance. Other sections and the page heading are unchanged.

Wikipedia retains its existing link underlines and headline styling.

### Local checks

Load `manifest.json` as a temporary add-on in Firefox's
`about:debugging#/runtime/this-firefox`. Reload the extension and refresh an article
after editing. Check Palermo's **See** listings against their Wikipedia articles,
then verify that **Eat**, map markers, and description links retain their styling.

For deterministic regression checks, run `python3 -m http.server 8000` from the
repository root and open
[the browser checks](http://localhost:8000/tests/wikivoyage.html). All checks should
pass. They use real DOM fixtures and mocked API responses without dependencies.

Ever browsed through wikipedia, ran down a rabbit hole and became more and more disoriented by the amount of links shown on a wikipedia page?

Which of these links are important?

![grafik](https://user-images.githubusercontent.com/65167682/236006034-6360f7a7-6ea4-4815-9b91-c617ad0e7e02.png)

Which of these guys are important?

![grafik](https://user-images.githubusercontent.com/65167682/236006195-1c183957-6e44-496f-a419-922f5f582bc2.png)



## Fear no more!!!

This Add-on changes the color of the hyperlink on any wikipedia article, according to how important (i.e. how many translation the wikipedia arcticles possesses) the page is. 

![grafik](https://user-images.githubusercontent.com/65167682/236006533-9da40937-e5ec-4a40-9fe2-396d8b9769a7.png)

![grafik](https://user-images.githubusercontent.com/65167682/236006700-a70d9e04-e031-47c2-9a3a-bc11854472b0.png)

The coloring rules are similar to that of item rarity coloring of recent MMO's. This means that links get colored by the following Tiers:

![grafik](https://user-images.githubusercontent.com/65167682/236008777-714b9dbd-1eec-4ce6-b41b-e9d97a6d938a.png) TIER 0 

![grafik](https://user-images.githubusercontent.com/65167682/236009136-f4354192-9fda-4f40-910b-daf4ef51e555.png) TIER 1

![grafik](https://user-images.githubusercontent.com/65167682/236009392-2b4535f2-a5a9-4b45-a314-6873ea22da76.png) TIER 2

![grafik](https://user-images.githubusercontent.com/65167682/236009776-8af59c4d-7936-4e80-97d8-5b6d32e790fe.png) TIER 3

![grafik](https://user-images.githubusercontent.com/65167682/236010003-0bcee9d2-2d46-4d84-9c25-1666c0b53e4e.png) TIER 4

![grafik](https://user-images.githubusercontent.com/65167682/236010173-d56804ca-731e-438e-836c-0d28c0d8e363.png) TIER 5

![grafik](https://user-images.githubusercontent.com/65167682/236010297-4d831fd0-d622-42a9-9197-6acce8c1b5c3.png) ERROR - something went wrong with fetching the data needed (mostly happens because of internal wikipedia redirects)








