import {Format} from "./Format.js";
import fs from "node:fs";
import path from "node:path";
import { EnglishTranslation } from "./EnglishTranslation.js";

export class Ecmarkup {
  constructor(writer) {
    this.html = ""
    this.writer = writer;
    this.sectionStack = [];
    this.sectionIds = []; // Track section IDs for proper nesting
    this.sectionIdsUsed = []; // Track all used section IDs to ensure uniqueness
    this.openSpec();
  }

  openSpec() {
    //this.append(`<!DOCTYPE html>\n`);
  }

  closeSpec() {
    while (this.sectionStack.length > 0) this.endSection();
    this.readFiles("post");
    this.write();
  }

  append(html) {
    this.html += html;
    return this;
  }

  write() {
    this.writer.write(this.html);
    this.html = "";
  }

  getUniqueSectionId(baseId) {
    let newId = baseId;
    let counter = 1;
    while (this.sectionIdsUsed.includes(newId)) {
      newId = `${baseId}-${counter}`;
      counter++;
    }
    this.sectionIdsUsed.push(newId);
    return newId;
  }

  openSection(id, isDeprecated) {
    let newId = this.getUniqueSectionId(id);

    // Check if any parent section is already marked as legacy
    let parentHasLegacy = false;
    if (isDeprecated && isDeprecated === true) {
      // Check if we have any sections in the stack (i.e., we're in a nested section)
      if (this.sectionStack.length > 0) {
        // Look for the last occurrence of "legacy" in the HTML
        const lastHtmlChunk = this.html.substring(this.html.lastIndexOf("<emu-clause"));
        parentHasLegacy = lastHtmlChunk.includes(" legacy>");
      }
    }

    // Only add legacy attribute if parent doesn't have it
    let legacy = (isDeprecated && isDeprecated === true && !parentHasLegacy) ? "legacy" : "";
    this.append(`<emu-clause id=\"${newId}\" ${legacy}>\n`);
    this.sectionStack.push(newId);
    this.sectionIds.push(newId);
    return this;
  }

  endSection() {
    if (this.sectionStack.length > 0) {
      this.append(`</emu-clause>`);
      this.sectionStack.pop();
      this.sectionIds.pop(); // Remove the section ID when closing the section
    }
    return this;
  }

  addParagraph(label, content) {
    if (content) {
      const translatedContent = EnglishTranslation.translate(content);
      const processedContent = this.processMarkdownLinks(translatedContent);
      this.append(`<p><strong>${label}:</strong> ${processedContent}</p>`);
    }
    return this;
  }

  addOrigin(origin) {
    return this.addParagraph("Reference", origin);
  }

  addSectionTitle(title) {
    if (title) {
      const translatedTitle = this.sentenceCase(title);
      this.append(`<h1>${translatedTitle}</h1>\n`);
    }
    return this;
  }

  addLocation(breadcrumb) {
    if (breadcrumb) {
      this.append(`<p class="properties"><strong>Location:</strong> ${breadcrumb}<br>\n`);
    }
    return this;
  }

  addPropertyWithLabel(propertyName, requiredLabel, deprecated = false) {
    if (propertyName) {
      const requiredStr = requiredLabel ? ` (${requiredLabel})` : "";
      const deprecatedStr = deprecated ? " and Deprecated" : "";
      //this.append(`<strong>Property:</strong> ${propertyName}${requiredStr}${deprecatedStr}<br>\n`);
      this.append(`<strong>Property:</strong> ${propertyName}${requiredStr}<br>\n`);
    }
    return this;
  }

  openPropertySection(breadcrumb, title, propertyName, schemaObject, fromArray, appendedDescription, omitLocation, isDeprecated) {
    const id = `sec-${breadcrumb.replace(/[^a-zA-Z0-9\-]+/g, "-").toLowerCase()}`;
    this.openSection(id, isDeprecated);

    // Add title
    if (title) {
      this.addSectionTitle(title);
    }

    // Add breadcrumb
    if (breadcrumb && !omitLocation) {
      this.addLocation(breadcrumb);
    } else {
      this.append('<p class="properties">');
    }

    // Add property
    if (propertyName && !fromArray) {
      const requiredLabel = schemaObject.requiredLabel ? schemaObject.requiredLabel : "";
      const isDeprecated = schemaObject && schemaObject.description &&
        schemaObject.description.toUpperCase().includes("[DEPRECATED]");
      this.addPropertyWithLabel(propertyName, requiredLabel, isDeprecated);
    }

    return this;
  }

  addProperties(schemaObject, appendedDescription) {
    // Add type
    let extendedTypeInfo = schemaObject.enum ? " (enum)" : "";
    if (schemaObject.typeLabel || schemaObject.type) {
      this.append(`<strong>Type:</strong> ${schemaObject.typeLabel ? schemaObject.typeLabel : this.sentenceCase(schemaObject.type)}${extendedTypeInfo}<br>\n`);
    }

    if (schemaObject.uniqueItems && schemaObject.uniqueItems === true) {
      this.append("<strong>Uniqueness:</strong> All items shall be unique.");
    }

    // Add minimum
    if (schemaObject.minimum) {
      this.append(`<strong>Minimum Value:</strong> ${schemaObject.minimum}<br>\n`);
    }

    // Add maximum
    if (schemaObject.maximum) {
      this.append(`<strong>Maximum Value:</strong> ${schemaObject.maximum}<br>\n`);
    }

    // Add default
    if (schemaObject.default) {
      this.append(`<strong>Default Value:</strong> ${schemaObject.default}<br>\n`);
    }

    // Add format
    if (schemaObject.format) {
      let format = this.processMarkdownLinks(Format.description(schemaObject.format));
      this.append(`<strong>Format:</strong> ${format}<br>\n`);
    }

    // Add constant
    if (schemaObject.const) {
      this.append(`<strong>Constant:</strong> ${schemaObject.const}<br>\n`);
    }

    // Add pattern
    if (schemaObject.pattern) {
      this.append(`<strong>Pattern Constraint:</strong> <code class="pattern">${schemaObject.pattern}</code><br>\n`);
    }

    // Add description
    if (schemaObject.description) {
      let description = schemaObject.description;
      if (appendedDescription) {
        description += " " + appendedDescription;
      }
      description = EnglishTranslation.translate(this.processMarkdownLinks(description));
      this.append(`</p><p>${description}</p>\n`);
    } else {
      this.append('</p>\n');
    }

    return this;
  }

  addExamples(examples) {
    if (examples && examples.length > 0) {
      for (const example of examples) {
        this.append('<emu-example><pre>\n');
        this.append(example);
        this.append('</pre></emu-example>\n');
      }
    }
    return this;
  }

  addEnums(enumValues, metaEnum, tableCounter) {
    if (enumValues && metaEnum) {
      const rows = Object.entries(metaEnum).map(([key, val]) => [key, val]);
      this.append(`<emu-table>\n`);
      this.append(`<emu-caption id="caption-${tableCounter}">Enumeration of possible values</emu-caption>\n`);
      this.append(`<table>\n`);
      this.append(`<thead><tr><th>Value</th><th>Description</th></tr></thead>\n`);
      for (const row of rows) {
        const processedDescription = EnglishTranslation.translate(this.processMarkdownLinks(row[1]));
        this.append(`<tr><td class="nowrap">${row[0]}</td><td>${processedDescription}</td></tr>\n`);
      }
      this.append(`</table>\n`);
      this.append(`</emu-table>\n`);
    } else if (enumValues) {
      this.append("Enumeration of possible values:<br>");
      this.append("<ul>\n");
      for (const value of enumValues) {
        this.append(`<li>${value}</li>\n`);
      }
      this.append("</ul>\n");
    }
    return this;
  }

  addPropertiesTable(breadcrumb, propertyName, properties, tableCounter) {
    this.append(`<emu-table>\n`);
    this.append(`<emu-caption id="caption-${tableCounter}">Properties for the ${breadcrumb === "/" ? "root" : propertyName} object</emu-caption>\n`);
    this.append(`<table>\n`);
    this.append(`<thead><tr><th>Property</th><th>Type</th><th>Requirement</th><th>Description</th></tr></thead>\n`);

    return this;
  }

  addPropertyTableRow(key, type, requiredLabel, description) {
    const processedDescription = EnglishTranslation.translate(this.processMarkdownLinks(description));
    this.append(`<tr><td>${key}</td><td>${type}</td><td>${requiredLabel}</td><td>${processedDescription}${processedDescription?.endsWith('.') ? '' : '.'}</td></tr>\n`);
    return this;
  }

  closePropertiesTable() {
    this.append(`</table>\n`);
    this.append(`</emu-table>\n`);
    return this;
  }

  openArraySection(breadcrumb, title, propertyName, requiredLabel, type, description, appendedDescription, isDeprecated, unique) {
    const id = `sec-${breadcrumb.replace(/[^a-zA-Z0-9\-]+/g, "-").toLowerCase()}`;
    this.openSection(id, isDeprecated);

    // Add title
    if (title) {
      this.addSectionTitle(title);
    } else if (propertyName) {
      this.append(`<h1>${propertyName}</h1>\n`);
    }

    // Add breadcrumb, property, type, etc.
    if (breadcrumb) {
      this.addLocation(breadcrumb);
    } else {
      this.append('<p class="properties">');
    }

    if (propertyName) {
      const requiredStr = requiredLabel ? ` (${requiredLabel})` : "";
      this.append(`<strong>Property:</strong> ${propertyName}${requiredStr}<br>\n`);
    }

    if (type) {
      this.append(`<strong>Type:</strong> ${type}<br>\n`);
    }

    if (unique) {
      this.append("<strong>Uniqueness:</strong> All items shall be unique.");
    }

    if (description) {
      let desc = description;
      if (appendedDescription) {
        desc += " " + appendedDescription;
      }
      desc = EnglishTranslation.translate(this.processMarkdownLinks(desc));
      this.append(`</p><p>${desc}</p>\n`);
    } else {
      this.append('</p>\n');
    }

    return this;
  }

  addComplexTypeNote(complexTypeLabel) {
    this.addImportantNote(`Shall be ${complexTypeLabel}:`);
    return this;
  }

  startNumberedList() {
    this.append("<ol>\n");
    return this;
  }

  endNumberedList() {
    this.append("</ol>\n");
    return this;
  }

  startUnorderedList() {
    this.append("<ul>\n");
    return this;
  }

  endUnorderedList() {
    this.append("</ul>\n");
    return this;
  }

  addImportantNote(string) {
    if (string) {
      string = EnglishTranslation.translate(string);
      string = this.processMarkdownLinks(string);
      this.append(`<p><em>${string}</em></p>`);
    }
    this.write();
    return this;
  }

  addNonNormativeNote(string) {
    if (string) {
      string = EnglishTranslation.translate(string);
      string = this.processMarkdownLinks(string);
      this.append(`<emu-note><em>${string}</em></emu-note>`);
    }
    this.write();
    return this;
  }

  addNumberedBullet(value) {
    if (value) {
      const translatedValue = EnglishTranslation.translate(value);
      const processedValue = this.processMarkdownLinks(translatedValue);
      this.append(`<li>${processedValue}</li>`);
    }
    this.write();
    return this;
  }

  sentenceCase(input) {
    if (input) {
      return input.charAt(0).toUpperCase() + input.slice(1);
    }
    return input;
  }

  processMarkdownLinks(text) {
    if (!text) return text;
    // Regular expression to match markdown links: [text](url)
    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    // Replace all markdown links with HTML links
    return text.replace(markdownLinkRegex, '<a href="$2">$1</a>');
  }

  readFiles(mode = "pre") {
    const directory = "excerpts";
    let filenames = fs.readdirSync(directory);

    // Filter files based on mode
    filenames = filenames.filter(filename => {
      if (!filename.endsWith(".html")) return false;

      if (mode === "pre") {
        return filename.startsWith("0x");
      } else if (mode === "post") {
        return filename.startsWith("1x");
      }
      return false;
    });
    filenames.sort();
    for (let filename of filenames) {
      this.append(fs.readFileSync(directory + path.sep + filename, 'utf-8'));
      this.write();
    }
  }
}
