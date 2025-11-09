import {SectionNumber} from "./SectionNumber.js";
import {Ecmarkup} from "./Ecmarkup.js";
import {Reference} from "./Reference.js";
import {ComplexType} from "./ComplexType.js";
import cloneDeep from "lodash/cloneDeep.js";

export class EcmarkupGenerator {

  constructor(schema, writer) {
    this.md = new Ecmarkup(writer);
    this.sectionNumber = new SectionNumber();
    this.sectionNumber.incrementCounter(6);
    this.schema = schema;
    this.imposters = [];
    this.breadcrumbsUsed = [];
    this.tableCounter = 1;
    this.figureCounter = 1;
    this.md.readFiles("pre");
    if (this.schema.type === "object") {
      this.processJsonObject(this.schema, null, "/", false);
    } else if (this.schema.type === "array") {
      this.processJsonArray(this.schema, null, "/");
    } else {
      throw new Error("Unsupported schema type: " + this.schema.type);
    }
    this.md.closeSpec();
  }

  get ecmarkup() {
    return this.md;
  }

  isImposter(schemaObject, breadcrumb) {
    if (schemaObject.imposter) {
      return true;
    }
    for (let value of this.imposters) {
      if (breadcrumb.startsWith(value)) {
        return true;
      }
    }
    if (schemaObject["$ref"]) {
      const obj = Reference.lookup(schemaObject["$ref"]);
      if (obj) {
        if (obj[1] !== breadcrumb) {
          schemaObject.origin = obj[2];
          if (obj[4]) schemaObject.description = obj[4];
          this.imposters.push(breadcrumb);
          return true;
        }
      }
    }
    if (breadcrumb) {
      const obj = Reference.fuzzyLookup(breadcrumb);
      if (obj) {
        if (! breadcrumb.startsWith(obj[1])) {
          schemaObject.origin = obj[2];
          if (obj[4]) schemaObject.description = obj[4];
          this.imposters.push(breadcrumb);
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Determines the type of a schema object property
   * @param {Object} schemaObject - The schema object to determine the type for
   * @returns {string} - The type of the schema object
   */
  determinePropertyType(schemaObject) {
    let type = schemaObject.type;

    if (schemaObject.oneOf && schemaObject.oneOf instanceof Array) {
      type = "Array";
    } else if (schemaObject.anyOf && schemaObject.anyOf instanceof Array) {
      type = "Array";
    } else if (schemaObject.allOf && schemaObject.allOf instanceof Array) {
      type = "Array";
    }

    return type;
  }

  /**
   * Processes a property based on its type and adds it to the documentation
   * @param {Object} rso - The resolved schema object
   * @param {string} key - The property key
   * @param {string} breadcrumb - The breadcrumb path
   * @param {boolean} fromArray - Whether this is processing an array item
   */
  processPropertyByType(rso, key, breadcrumb, fromArray) {
    const newBreadcrumb = this.addCrumb(breadcrumb, key);

    if (rso.type === "array") {
      this.processJsonArray(rso, key, newBreadcrumb);
    } else if (rso.type === "object") {
      this.processJsonObject(rso, key, newBreadcrumb, fromArray);
    } else if (rso.oneOf) {
      this.processJsonProperty(rso, key, newBreadcrumb, fromArray);
      this.processJsonComplexType(rso, ComplexType.ONE_OF, key, newBreadcrumb);
    } else if (rso.anyOf) {
      this.processJsonProperty(rso, key, newBreadcrumb, fromArray);
      this.processJsonComplexType(rso, ComplexType.ANY_OF, key, newBreadcrumb);
    } else if (rso.allOf) {
      this.processJsonProperty(rso, key, newBreadcrumb, fromArray);
      this.processJsonComplexType(rso, ComplexType.ALL_OF, key, newBreadcrumb);
    } else {
      this.processJsonProperty(rso, key, newBreadcrumb, fromArray);
    }
  }

  processJsonObject(schemaObject, propertyName, breadcrumb, fromArray) {
    let imposter = this.isImposter(schemaObject, breadcrumb);
    let so = this.resolveSchemaDefinition(schemaObject);
    this.enhanceSchemaObjectWithRequired(so);

    // Check if this is a simple property (not an object or array)
    // Simple properties should not contain nested elements
    if (so.type && so.type !== "object" && so.type !== "array" && !so.properties && !so.oneOf && !so.anyOf && !so.allOf) {
      // For simple properties, use processJsonProperty which handles them correctly
      this.processJsonProperty(so, propertyName, breadcrumb, fromArray);
      return;
    }

    // Open section
    const id = `sec-${breadcrumb.replace(/[^a-zA-Z0-9\-]+/g, "-").toLowerCase()}`;
    this.md.openSection(id, schemaObject.deprecated);

    if (so.title) {
      this.md.addSectionTitle(so.title);
    } else if (propertyName) {
      this.md.addSectionTitle(propertyName);
    }
    if (breadcrumb) {
      this.md.addLocation(breadcrumb);
    }
    if (propertyName && !fromArray) {
      this.md.addPropertyWithLabel(propertyName, so.requiredLabel);
    }

    this.md.addProperties(so);
    this.md.addExamples(so.examples);

    // Handle the case where an object has both properties and allOf
    let allProperties = {};
    if (so.properties) {
      allProperties = {...so.properties};
    }

    // If the object has allOf, collect properties from allOf items
    if (!imposter && so.allOf) {
      for (let allOfItem of so.allOf) {
        let resolvedItem = this.resolveSchemaDefinition(allOfItem);
        // Enhance the resolved item with required labels before merging properties
        this.enhanceSchemaObjectWithRequired(resolvedItem);
        if (resolvedItem.properties) {
          allProperties = {...allProperties, ...resolvedItem.properties};
        }
      }
    }

    // Add properties table if this object has properties (either its own or from allOf)
    if (!imposter && Object.keys(allProperties).length > 0) {
      this.md.addPropertiesTable(breadcrumb, propertyName, allProperties, this.tableCounter++);

      for (let key in allProperties) {
        if (!key.startsWith("$")) {
          let rso = allProperties[key]["$ref"] ? this.resolveSchemaDefinitionFromRef(allProperties[key]["$ref"].split("/").pop()) : allProperties[key];
          rso.requiredLabel = allProperties[key].requiredLabel;
          let type = this.determinePropertyType(rso);
          let description = allProperties[key].description;
          this.md.addPropertyTableRow(key, this.sentenceCase(type), rso.requiredLabel, description);
        }
      }

      this.md.closePropertiesTable();

      // Process child properties
      for (let key in allProperties) {
        if (!key.startsWith("$")) {
          // assign the schema, optionally resolving the reference first.
          let rso = allProperties[key]["$ref"] ? this.resolveSchemaDefinitionFromRef(allProperties[key]["$ref"].split("/").pop()) : allProperties[key];
          rso.imposter = this.isImposter( allProperties[key], this.addCrumb(breadcrumb, key));
          rso.requiredLabel = allProperties[key].requiredLabel;
          rso.origin = allProperties[key].origin;
          rso.title = (allProperties[key].title) ? allProperties[key].title : rso.title;
          rso.description = (allProperties[key].description) ? allProperties[key].description : rso.description;
          rso.examples = (allProperties[key].examples) ? allProperties[key].examples : rso.examples;

          this.processPropertyByType(rso, key, breadcrumb, fromArray);
        }
      }
    } else if (!imposter && so.oneOf) {
      this.processJsonComplexType(so, ComplexType.ONE_OF, propertyName, breadcrumb);
    } else if (!imposter && so.anyOf) {
      this.processJsonComplexType(so, ComplexType.ANY_OF, propertyName, breadcrumb);
    } else if (!imposter && so.allOf) {
      this.processJsonComplexType(so, ComplexType.ALL_OF, propertyName, breadcrumb);
    }

    this.md.endSection();
  }

  /**
   * Validates and prepares a schema object for processing as a property
   * @param {Object} so - The schema object to validate
   * @param {string} propertyName - The property name
   * @param {string} breadcrumb - The breadcrumb path
   * @param {boolean} fromArray - Whether this is processing an array item
   * @returns {Object} - The validated and prepared schema object
   */
  validateAndPrepareSchemaObject(so, propertyName, breadcrumb, fromArray) {
    // Special case for license/id
    if (breadcrumb.endsWith("/license/id")) {
      so.enum = undefined;
    }

    // Increment section number
    this.incrementSectionNumber(so, breadcrumb);

    // Set title if missing
    if (breadcrumb && !breadcrumb.endsWith("[]") && !so.title) {
      console.warn("No title exists for: " + breadcrumb);
      so.title = propertyName || "Unnamed Section";
    }

    // Validate type
    if (!so.type && !fromArray && !so.oneOf && !so.anyOf) {
      throw new Error("Explicit type not defined for " + breadcrumb);
    }

    // Set typeLabel if missing
    if (!so.typeLabel && so.type) {
      so.typeLabel = this.sentenceCase(so.type);
    }

    return so;
  }

  /**
   * Processes a JSON property and adds it to the documentation
   * @param {Object} so - The schema object
   * @param {string} propertyName - The property name
   * @param {string} breadcrumb - The breadcrumb path
   * @param {boolean} fromArray - Whether this is processing an array item
   * @param {string} appendedDescription - Additional description to append
   * @param {boolean} omitLocation - Whether to omit the location in the output
   */
  processJsonProperty(so, propertyName, breadcrumb, fromArray, appendedDescription, omitLocation) {
    // Validate and prepare the schema object
    so = this.validateAndPrepareSchemaObject(so, propertyName, breadcrumb, fromArray);

    // Open property section
    this.md.openPropertySection(breadcrumb, so.title, propertyName, so, fromArray, appendedDescription, omitLocation, so.deprecated);

    // Add property details
    this.md.addProperties(so, appendedDescription);
    this.md.addExamples(so.examples);
    this.md.addEnums(so.enum, so["meta:enum"], this.tableCounter++);

    // Add origin if present
    if (so.origin) {
      this.md.addOrigin(so.origin);
    }

    // Close the section
    this.md.endSection();
  }

  /**
   * Takes a schema object of type "array" which has only a single item type, and
   * merges the properties for that item back to the array itself. This helps to
   * simplify the resulting documentation. Before passing in the schema object,
   * it is important to cloneDeep the schema object.
   */
  mergeJsonSingleItemProperty(so) {
    if (!so.type) {
      throw new Error("Explicit type not defined for " + JSON.stringify(so));
    }
    so.minimum = so.items.minimum;
    so.maximum = so.items.maximum;
    so.default = so.items.default;
    so.format = so.items.format;
    so.pattern = so.items.pattern;
    if (so.items.description) {
      if (so.description) {
        so.description = so.description + " " + so.items.description;
      } else {
        so.description = so.items.description;
      }
    }
    if (so.examples && so.items.examples) {
      throw new Error("The array with a single item property both contain examples. Cannot compute.");
    }
    if (!so.examples) {
      so.examples = so.items.examples;
    }
    if (so.enum || so["meta:enum"]) {
      throw new Error("The array with a single item property contains an unexpected enum.");
    }
    so.enum = so.items.enum;
    so["meta:enum"] = so.items["meta:enum"];
  }

  /**
   * Creates an appended description for array items
   * @param {Object} itemSchema - The schema of the array items
   * @returns {string} - The appended description
   */
  createArrayItemDescription(itemSchema) {
    if (!itemSchema) return "";

    if (itemSchema.type && itemSchema.type !== "array" && itemSchema.type !== "object") {
      return `Each item of this array shall be ${this.chooseArticle(itemSchema.type)} ${itemSchema.type}.`;
    } else if (itemSchema.title) {
      return `Each item of this array shall be ${this.chooseArticle(itemSchema.title)} ${itemSchema.title} object.`;
    }

    return "";
  }

  /**
   * Handles complex type (oneOf, anyOf) in array processing
   * @param {Object} so - The schema object
   * @param {string} propertyName - The property name
   * @param {string} breadcrumb - The breadcrumb path
   * @param {ComplexType} complexType - The complex type (ONE_OF or ANY_OF)
   */
  handleArrayComplexType(so, propertyName, breadcrumb, complexType) {
    this.processJsonProperty(so, propertyName, breadcrumb, false);
    if (!so.imposter) {
      this.processJsonComplexType(so, complexType, propertyName, breadcrumb);
    }
  }

  processJsonArray(so, propertyName, breadcrumb) {
    // If the schemaObject is an array of items, but they are all the same type
    if (so.items && so.items.type && (so.items.type !== "array" && so.items.type !== "object")) {
      let tempSo = cloneDeep(so);
      tempSo.typeLabel = this.sentenceCase(tempSo.type) + " (of " + this.sentenceCase(tempSo.items.type) + ")";
      let appendedDescription = this.createArrayItemDescription(tempSo.items);
      this.mergeJsonSingleItemProperty(tempSo);
      this.processJsonProperty(tempSo, propertyName, breadcrumb, false, appendedDescription);
    } else if (so.items) {
      let tempSo = this.resolveSchemaDefinition(so.items);
      let appendedDescription = this.createArrayItemDescription(tempSo);

      // Open array section
      this.md.openArraySection(
        breadcrumb,
        so.title,
        propertyName,
        so.requiredLabel,
        this.sentenceCase(so.type),
        so.description,
        appendedDescription,
        so.deprecated
      );

      // Use "[]" for array items in the breadcrumb
      // This reverts to the previous behavior where arrays end in /[]
      let itemName = propertyName;
      if (propertyName && propertyName.endsWith('s')) {
        if (propertyName.endsWith('ies')) {
          // Singularization - convert 'ies' to 'y'
          // (vulnerabilities, assemblies, dependencies)
          itemName = propertyName.replace(/ies$/, 'y');
        } else if (propertyName.endsWith('hes')) {
          // Singularization - convert 'es' to ''
          // (hashes, patches)
          itemName = propertyName.replace(/hes$/, 'h');
        } else {
          // Simple singularization - remove the trailing 's'
          itemName = propertyName.slice(0, -1);
        }
      }

      // Process the array items within the array section
      this.processJsonObject(so.items, itemName, this.addCrumb(breadcrumb, "[]"), true);

      // Close the array section after all items have been processed
      this.md.endSection();
    } else if (so.oneOf) {
      this.handleArrayComplexType(so, propertyName, breadcrumb, ComplexType.ONE_OF);
    } else if (so.anyOf) {
      this.handleArrayComplexType(so, propertyName, breadcrumb, ComplexType.ANY_OF);
    } else if (so.allOf) {
      this.handleArrayComplexType(so, propertyName, breadcrumb, ComplexType.ALL_OF);
    } else {
      throw new Error("Unhandled condition encountered. Generated documentation may be incorrect.")
    }

    if (so.uniqueItems && so.uniqueItems === true) {
      this.md.addImportantNote("All items shall be unique.");
    }
  }

  /**
   * Processes the options in a complex type (oneOf, anyOf)
   * @param {Object} options - The array of options
   * @param {string} propertyName - The property name
   * @param {string} breadcrumb - The breadcrumb path
   */
  processComplexTypeOptions(options, propertyName, breadcrumb) {
    for (let i = 0; i < options.length; i++) {
      let option = options[i];

      // Ensure option has a type
      if (!option.type) {
        option.type = propertyName ? "object" : "string"; // Default type if not specified
      }

      // Ensure option has a title
      if (!option.title) {
        console.warn("missing title in: " + breadcrumb);
        option.title = "Unnamed Option";
      }

      // Process required properties
      this.enhanceSchemaObjectWithRequired(option);

      // Process the option as a property
      this.processJsonProperty(option, null, breadcrumb, false, null, true);

      // Add properties table if this option has properties
      if (option.properties) {
        this.addPropertiesTableForOption(option, breadcrumb);
      }
    }
  }

  /**
   * Adds a properties table for a complex type option
   * @param {Object} option - The option object
   * @param {string} breadcrumb - The breadcrumb path
   */
  addPropertiesTableForOption(option, breadcrumb) {
    this.md.addPropertiesTable(breadcrumb, option.title.toLowerCase(), option.properties, this.tableCounter++);

    for (let key in option.properties) {
      let obj = option.properties[key];
      let referenceText = this.getReferenceText(obj);
      this.md.addPropertyTableRow(key, this.sentenceCase(obj.type), obj.requiredLabel, obj.description + referenceText);
    }

    this.md.closePropertiesTable();
  }

  /**
   * Gets reference text for an object if it has a reference
   * @param {Object} obj - The object to check for references
   * @returns {string} - The reference text or empty string
   */
  getReferenceText(obj) {
    if (obj.items && obj.items['$ref']) {
      let reference = Reference.lookup(obj.items['$ref']);
      if (reference) {
        return " " + reference[2];
      }
    }
    return "";
  }

  /**
   * Processes child properties of complex type options
   * @param {Object} options - The array of options
   * @param {string} propertyName - The property name
   * @param {string} breadcrumb - The breadcrumb path
   */
  processComplexTypeChildProperties(options, propertyName, breadcrumb) {
    for (let i = 0; i < options.length; i++) {
      let option = options[i];

      // Process option as array if it's an array type
      if (option.type === "array") {
        this.processJsonArray(option, propertyName, breadcrumb);
      }

      // Process each property of the option
      for (let key in option.properties) {
        let obj = option.properties[key];
        this.processPropertyByType(obj, key, breadcrumb, false);
      }
    }
  }

  processJsonComplexType(so, complexType, propertyName, breadcrumb) {
    if (!so[complexType.property]) {
      throw new Error(`Schema object missing expected '${complexType.property}' property.`);
    }

    // Add complex type note
    this.md.addComplexTypeNote(complexType.label);

    // Start numbered list for options
    this.md.startNumberedList();

    // Add option titles
    for (let i = 0; i < so[complexType.property].length; i++) {
      let option = so[complexType.property][i];
      if (option.type || option.required) {
        this.md.addNumberedBullet(option.title);
      }
    }

    // End numbered list
    this.md.endNumberedList();

    // Process each option
    this.processComplexTypeOptions(so[complexType.property], propertyName, breadcrumb);

    // Process child properties
    this.processComplexTypeChildProperties(so[complexType.property], propertyName, breadcrumb);
  }

  addCrumb(breadcrumb, newcrumb) {
    breadcrumb = breadcrumb + "/" + newcrumb;
    return breadcrumb.replace("//", "/");
  }

  enhanceSchemaObjectWithRequired(schemaObject) {
    if (schemaObject && schemaObject.properties) {
      for (let key in schemaObject.properties) {
        if (!key.startsWith("$")) {
          let requiredLabel = "Optional";
          if (schemaObject.required && schemaObject.required.includes(key)) {
            requiredLabel = "Required";
          }
          schemaObject.properties[key].requiredLabel = requiredLabel;
        }
      }
    }
  }

  /**
   * Resolves a schema definition, handling references if present
   * @param {Object} schemaObject - The schema object to resolve
   * @returns {Object} - The resolved schema object
   */
  resolveSchemaDefinition(schemaObject) {
    if (!schemaObject) return {};

    if (schemaObject["$ref"]) {
      const ref = schemaObject["$ref"].split("/").pop();
      const resolvedSchema = this.resolveSchemaDefinitionFromRef(ref);

      if (resolvedSchema) {
        // Preserve origin from the original schema object
        resolvedSchema.origin = schemaObject.origin;
        return resolvedSchema;
      }
    }

    return schemaObject;
  }

  /**
   * Resolves a schema definition from a reference
   * @param {string} ref - The reference to resolve
   * @returns {Object} - The resolved schema object or undefined if not found
   */
  resolveSchemaDefinitionFromRef(ref) {
    if (!ref || !this.schema.definitions || !this.schema.definitions[ref]) {
      return undefined;
    }

    return cloneDeep(this.schema.definitions[ref]);
  }

  sentenceCase(input) {
    if (input) {
      return input.charAt(0).toUpperCase() + input.slice(1);
    }
    return input;
  }

  chooseArticle(word) {
    if (!word) {
      return "an";
    }
    // Normalize the word to lowercase to simplify comparisons
    const normalizedWord = word.toLowerCase();
    // List of exceptions where words begin with a vowel but use "a"
    const exceptionsWithA = [];
    // List of exceptions where words begin with a consonant but use "an"
    const exceptionsWithAn = [];
    // Check for exceptions first
    if (exceptionsWithA.some(exception => normalizedWord.startsWith(exception))) {
      return "a";
    } else if (exceptionsWithAn.some(exception => normalizedWord.startsWith(exception))) {
      return "an";
    }
    // General rule based on the first letter
    if (['a', 'e', 'i', 'o', 'u'].includes(normalizedWord[0])) {
      return "an";
    } else {
      return "a";
    }
  }

  incrementSectionNumber(so, breadcrumb) {
    let count = (breadcrumb.split("/").length - 1);
    if (so.type === "object" || so.type === "array" || so.oneOf || so.anyOf || so.allOf) {
      if (this.breadcrumbsUsed.includes(breadcrumb)) {
        this.sectionNumber.incrementCounter(count);
      } else {
        this.breadcrumbsUsed.push(breadcrumb);
        this.sectionNumber.incrementPosition(count);
      }
    } else {
      this.breadcrumbsUsed.push(breadcrumb);
      this.sectionNumber.incrementCounter(count);
    }
  }

}
