const zeroWidthRegex = /[\u200B-\u200D\uFEFF]/g;

export function createTextCleaner(words) {
  const normalizedWords = words.map(normalize);

  const patterns = normalizedWords.map(word => ({
    word,
    regex: new RegExp(`(?<!\\p{L})${escapeRegExp(word)}(?!\\p{L})`, "giu"),
  }));

  return function cleanText(text) {
    if (typeof text !== "string") return text;

    let cleaned = normalize(text);

    for (const { word, regex } of patterns) {
      cleaned = cleaned.replace(regex, "*".repeat(word.length));
    }

    return cleaned;
  };
}

function normalize(str) {
  return str
    .normalize("NFD")
    .replace(zeroWidthRegex, "")
    .replace(/(.)\1{2,}/g, "$1$1") // puuuute -> puute
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}