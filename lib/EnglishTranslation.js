export class EnglishTranslation {
  static US_to_Oxford_Dictionary = {
    // Color/our words
    'color': 'colour',
    'favor': 'favour',
    'behavior': 'behaviour',
    'honor': 'honour',
    'labor': 'labour',
    'neighbor': 'neighbour',
    'flavor': 'flavour',
    'harbor': 'harbour',

    // -re endings
    'center': 'centre',
    'theater': 'theatre',
    'meter': 'metre',
    'liter': 'litre',
    'fiber': 'fibre',
    'caliber': 'calibre',

    // -ce endings (nouns)
    'license': 'licence',
    'practice': 'practise',    // verb only
    'defense': 'defence',
    'offense': 'offence',
    'pretense': 'pretence',

    // -yse NOT -yze (Oxford uses -yse for these)
    'analyze': 'analyse',
    'paralyze': 'paralyse',
    'catalyze': 'catalyse',

    // Double consonants
    'traveled': 'travelled',
    'traveling': 'travelling',
    'traveler': 'traveller',
    'labeled': 'labelled',
    'labeling': 'labelling',
    'modeling': 'modelling',
    'modeled': 'modelled',
    'canceled': 'cancelled',
    'canceling': 'cancelling',
    'fueled': 'fuelled',
    'fueling': 'fuelling',

    // -ogue endings
    'catalog': 'catalogue',
    'dialog': 'dialogue',
    'analog': 'analogue',

    // Other common words
    'gray': 'grey',
    'artifact': 'artefact',
    'check': 'cheque',
    'program': 'programme',
    'tire': 'tyre',
    'plow': 'plough',
    'draft': 'draught',
    'aluminum': 'aluminium'
  };

  // Technical terms and proper nouns that should never be translated
  // Add patterns here that contain dictionary words but are technical specifications
  static protectedTerms = [
    /\bOmniBOR Artifact ID\b/gi,
    /\bArtifact ID\b/g,  // Protect "Artifact ID" when capitalized (likely a technical term)
    // Add more technical terms as needed:
    // /\bDocker Artifact\b/gi,
    // /\bBuild Artifact\b/gi,
  ];

  // RFC 2119 / ISO normative language mappings
  // ISO prohibits "must" - convert to "shall"
  static RFC_to_ISO_Mappings = [
    { pattern: /\bmust not\b/g, replacement: 'shall not' },
    { pattern: /\bmust\b/g, replacement: 'shall' },
    { pattern: /\bMust not\b/g, replacement: 'Shall not' },
    { pattern: /\bMust\b/g, replacement: 'Shall' },
    { pattern: /\bMUST NOT\b/g, replacement: 'shall not' },
    { pattern: /\bMUST\b/g, replacement: 'shall' },
    { pattern: /\bREQUIRED\b/g, replacement: 'required' },
    { pattern: /\bSHALL NOT\b/g, replacement: 'shall not' },
    { pattern: /\bSHALL\b/g, replacement: 'shall' },
    { pattern: /\bSHOULD NOT\b/g, replacement: 'should not' },
    { pattern: /\bSHOULD\b/g, replacement: 'should' },
    { pattern: /\bRECOMMENDED\b/g, replacement: 'recommended' },
    { pattern: /\bNOT RECOMMENDED\b/g, replacement: 'not recommended' },
    { pattern: /\bMAY\b/g, replacement: 'may' },
    { pattern: /\bOPTIONAL\b/g, replacement: 'optional' }
  ];

  static translationRegex = new RegExp(
    `\\b(${Object.keys(this.US_to_Oxford_Dictionary).join('|')})\\b`,
    'gi'
  );

  static capitalizeWord(word, template) {
    if (template === template.toUpperCase()) {
      return word.toUpperCase();
    } else if (template[0] === template[0].toUpperCase()) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    } else {
      return word;
    }
  }

  /**
   * Main translation function: US English + RFC → Oxford English + ISO compliance
   *
   * Performs two transformations:
   * 1. Normalizes RFC 2119 keywords (MUST → shall, SHOULD → should, etc.)
   * 2. Converts US English spellings to Oxford English
   * 3. Preserves technical terms and proper nouns
   *
   * @param {string} americanText - Input text in American English with RFC keywords
   * @returns {string} Oxford English with ISO-compliant normative language
   */
  static translate(americanText) {
    if (!americanText) return americanText;

    // Normalize RFC 2119 keywords to ISO compliance
    let text = americanText;
    for (const { pattern, replacement } of this.RFC_to_ISO_Mappings) {
      text = text.replace(pattern, replacement);
    }

    // Protect special patterns from translation
    const protectedPatterns = [];
    for (const termPattern of this.protectedTerms) {
      text = text.replace(termPattern, match => {
        protectedPatterns.push(match);
        return `__PROTECTED_${protectedPatterns.length - 1}__`;
      });
    }
    const protectionRegex = /@\S+|https?:\/\/\S+|\S+@\S+\.\S+|`[^`]+`/g;

    text = text.replace(protectionRegex, match => {
      protectedPatterns.push(match);
      return `__PROTECTED_${protectedPatterns.length - 1}__`;
    });

    // Apply Oxford English translation
    text = text.replace(this.translationRegex, match => {
      const lowerMatch = match.toLowerCase();
      const oxfordWord = this.US_to_Oxford_Dictionary[lowerMatch];
      return this.capitalizeWord(oxfordWord, match);
    });

    // Restore protected patterns
    protectedPatterns.forEach((pattern, index) => {
      text = text.replace(`__PROTECTED_${index}__`, pattern);
    });

    return text;
  }
}
