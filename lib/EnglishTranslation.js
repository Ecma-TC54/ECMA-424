export class EnglishTranslation {

  static US_to_UK_Dictionary = {
    'practices': 'practises',
    'license': 'licence',
    'artifact': 'artefact',
    'licensing': 'licencing',
    'licenses': 'licences',
    'behavior': 'behaviour',
    'program': 'programme',
    'disk': 'disc',
    'modelled': 'modeled',
    'install': 'instal',
    'analyzes': 'analyses',
    'labeled': 'labelled',
    'labeling': 'labelling',
    'tonnes': 'tons',
    'gases': 'gasses',
    'tunneling': 'tunnelling'
  };

  static capitalizeWord(word, template) {
    if (template === template.toUpperCase()) {
      return word.toUpperCase();
    } else if (template[0] === template[0].toUpperCase()) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    } else {
      return word;
    }
  }

  static translateToUK(content) {
    return content;
  }

  /*
  static translateToUK(americanText) {
      // Find and temporarily replace the @patterns
      const atPatternRegex = /@\S+/g;
      let protectedPatterns = [];
      let ukText = americanText.replace(atPatternRegex, match => {
          protectedPatterns.push(match);
          return `__PROTECTED_${protectedPatterns.length - 1}__`;
      });

      // Perform the translation on the rest of the text
      for (const [usWord, ukWord] of Object.entries(this.US_to_UK_Dictionary)) {
          const regex = new RegExp(`\\b${usWord}\\b`, 'gi');
          ukText = ukText.replace(regex, match => {
              return this.capitalizeWord(ukWord, match);
          });
      }

      // Restore the protected patterns
      protectedPatterns.forEach((pattern, index) => {
          const placeholderRegex = new RegExp(`__PROTECTED_${index}__`, 'g');
          ukText = ukText.replace(placeholderRegex, pattern);
      });

      return ukText;
  }
   */
}
