// Keep this list synchronized with the server-side leaderboard migration.
const BLOCKED_NAME_TERMS = [
  "ass",
  "asshole",
  "asswipe",
  "bastard",
  "bitch",
  "blowjob",
  "bullshit",
  "chink",
  "cock",
  "cocksucker",
  "cunt",
  "dick",
  "dickhead",
  "douche",
  "douchebag",
  "dumbass",
  "fag",
  "faggot",
  "fuck",
  "fucker",
  "fucking",
  "fuckoff",
  "fuckyou",
  "gook",
  "handjob",
  "hitler",
  "idiot",
  "imbecile",
  "jackass",
  "kike",
  "kkk",
  "loser",
  "moron",
  "motherfucker",
  "motherfucking",
  "nazi",
  "nigga",
  "nigger",
  "penis",
  "porn",
  "porno",
  "prick",
  "pussy",
  "rape",
  "rapist",
  "retard",
  "retarded",
  "rimjob",
  "scumbag",
  "shit",
  "shithead",
  "shitty",
  "slut",
  "spic",
  "stupid",
  "tranny",
  "twat",
  "vagina",
  "wanker",
  "wetback",
  "whore",
];

const LEET_REPLACEMENTS = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "9": "g",
  "@": "a",
  $: "s",
  "!": "i",
};

function collapseRepeatedCharacters(value) {
  return value.replace(/(.)\1+/g, "$1");
}

function addCandidateForms(target, value) {
  if (!value) return;
  target.add(value);
  if (value.length >= 4) target.add(collapseRepeatedCharacters(value));
}

const BLOCKED_NAME_FORMS = new Set();
for (const term of BLOCKED_NAME_TERMS) {
  addCandidateForms(BLOCKED_NAME_FORMS, term);
}

/**
 * Checks a leaderboard name without using broad substring matches, which
 * avoids false positives in ordinary names such as "Dickens" or "Class Act".
 *
 * @param {string} name
 * @returns {boolean}
 */
export function hasBlockedName(name) {
  const normalized = name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[01345789@$!]/g, (character) => LEET_REPLACEMENTS[character]);

  const candidates = new Set();
  for (const word of normalized.split(/[^a-z0-9]+/)) {
    addCandidateForms(candidates, word);
  }
  addCandidateForms(candidates, normalized.replace(/[^a-z0-9]/g, ""));

  for (const candidate of candidates) {
    if (BLOCKED_NAME_FORMS.has(candidate)) return true;
  }
  return false;
}
