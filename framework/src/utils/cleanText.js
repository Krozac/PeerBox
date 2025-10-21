/**
 * Cleans a string by censoring banned words.
 * Replaces each banned word with asterisks (*) of equal length.
 *
 * @param {string} text - The input text to sanitize.
 * @param {string[]} bannedWords - Optional custom banned words list.
 * @returns {string} - The sanitized text.
 */
export function cleanText(text, bannedWords = defaultBannedWords) {
  if (typeof text !== "string") return text;

  let cleaned = text;

  for (const word of bannedWords) {
    const regex = new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi");
    cleaned = cleaned.replace(regex, "*".repeat(word.length));
  }

  return cleaned;
}

// Default banned words (can be extended by the user)
const defaultBannedWords = ["fuck", "shit", "bitch", "bastard", "asshole"];

/**
 * Escapes RegExp special characters in a string.
 * @param {string} str
 * @returns {string}
 */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
