/**
 * Maps a Wikidata sitelink count to the shared Wikipedia/Wikivoyage color tier.
 * @param {number} n Sitelink count.
 * @returns {string|undefined} HEX color string for supported ranges.
 */
function getColorOfNumber(n) {
    const colors = ["#0000FF", "#E6CC00", "#A420FC", "#CC5500", "#00C400", "#DC2367"]
    if (n < 10) { return colors[0] }
    if (n < 25) { return colors[1] }
    if (n < 50) { return colors[2] }
    if (n < 100) { return colors[3] }
    if (n < 150) { return colors[4] }
    if (n >= 150) { return colors[5] }
}
