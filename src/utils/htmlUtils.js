// Utilities for turning HTML article content into plain text for list excerpts.
// The article_listings view truncates content server-side; because the cut can land
// mid-tag or mid-entity, this also handles unclosed trailing fragments.

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  auml: 'ä',
  ouml: 'ö',
  uuml: 'ü',
  Auml: 'Ä',
  Ouml: 'Ö',
  Uuml: 'Ü',
  szlig: 'ß',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  euro: '€',
  copy: '©',
  reg: '®',
  sect: '§',
  deg: '°',
  ldquo: '“',
  rdquo: '”',
  bdquo: '„',
  lsquo: '‘',
  rsquo: '’',
};

export const htmlToPlainText = (html) => {
  if (!html) return '';
  let text = String(html)
    .replace(/<[^>]*>/g, ' ')
    // Tag fragment cut off mid-tag (no closing ">"), e.g. from server-side truncation
    .replace(/<[^>]*$/, ' ');
  text = text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (match, name) => NAMED_ENTITIES[name] ?? match)
    // Entity fragment cut off mid-entity, e.g. "&nb" or "&nb..." at the end of a
    // truncated excerpt (keeps a trailing ellipsis if present)
    .replace(/&#?[a-zA-Z0-9]{0,8}(\.\.\.)?$/, '$1');
  return text.replace(/\s+/g, ' ').trim();
};

export const makeExcerpt = (html, maxLength = 100) => {
  const plainText = htmlToPlainText(html);
  return plainText.length > maxLength
    ? `${plainText.substring(0, maxLength)}...`
    : plainText;
};
