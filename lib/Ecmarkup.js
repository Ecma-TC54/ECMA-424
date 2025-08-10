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
        this.append(`</body></html>\n`);
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
    let newId = baseId.replace(/-$/, "");
    let counter = 1;
    while (this.sectionIdsUsed.includes(newId)) {
      newId = `${baseId}-${counter}`;
      counter++;
    }
    this.sectionIdsUsed.push(newId);
    return newId;
  }

    openSection(id) {
        let newId = this.getUniqueSectionId(id);
        this.append(`<emu-clause id=\"${newId}\">\n`);
        //this.append(`<emu-clause id=\"${newId}\" id=\"${sectionNumber}\">\n`); //TODO
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
            const translatedContent = EnglishTranslation.translateToUK(content);
            this.append(`<p><strong>${label}:</strong> ${translatedContent}</p>`);
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
            this.append(`<p><strong>Location:</strong> ${breadcrumb}</p>\n`);
        }
        return this;
    }

    addPropertyWithLabel(propertyName, requiredLabel, deprecated = false) {
        if (propertyName) {
            const requiredStr = requiredLabel ? ` (${requiredLabel})` : "";
            const deprecatedStr = deprecated ? " and Deprecated" : "";
            this.append(`<p><strong>Property:</strong> ${propertyName}${requiredStr}${deprecatedStr}</p>\n`);
        }
        return this;
    }

    openPropertySection(breadcrumb, title, propertyName, schemaObject, fromArray, appendedDescription, omitLocation) {
        const id = `sec-${breadcrumb.replace(/[^a-zA-Z0-9\-]+/g, "-").toLowerCase()}`;
        this.openSection(id);

        // Add title
        if (title) {
            this.addSectionTitle(title);
        }

        // Add breadcrumb
        if (breadcrumb && !omitLocation) {
            this.addLocation(breadcrumb);
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
        if (schemaObject.typeLabel || schemaObject.type) {
            this.append(`<p><strong>Type:</strong> ${schemaObject.typeLabel ? schemaObject.typeLabel : this.sentenceCase(schemaObject.type)}</p>\n`);
        }

        // Add minimum
        if (schemaObject.minimum) {
            this.append(`<p><strong>Minimum Value:</strong> ${schemaObject.minimum}</p>\n`);
        }

        // Add maximum
        if (schemaObject.maximum) {
            this.append(`<p><strong>Maximum Value:</strong> ${schemaObject.maximum}</p>\n`);
        }

        // Add default
        if (schemaObject.default) {
            this.append(`<p><strong>Default Value:</strong> ${schemaObject.default}</p>\n`);
        }

        // Add format
        if (schemaObject.format) {
            this.append(`<p><strong>Format:</strong> ${schemaObject.format}</p>\n`);
        }

        // Add pattern
        if (schemaObject.pattern) {
            this.append(`<p><strong>Pattern Constraint:</strong> ${schemaObject.pattern}</p>\n`);
        }

        // Add description
        if (schemaObject.description) {
            let description = schemaObject.description;
            if (appendedDescription) {
                description += " " + appendedDescription;
            }
            this.append(`<p>${description}</p>\n`);
        }

        return this;
    }

    addExamples(examples) {
        if (examples && examples.length > 0) {
            this.append('<emu-example>\n');
            for (const example of examples) {
                this.append(`${example}\n`);
            }
            this.append('</emu-example>\n');
        }
        return this;
    }

    addEnums(enumValues, metaEnum, tableCounter) {
        if (enumValues && metaEnum) {
            const rows = Object.entries(metaEnum).map(([key, val]) => [key, val]);
            this.append(`<emu-table>\n`);
            this.append(`<emu-caption id="caption-${tableCounter}">Enumeration of possible values</emu-caption>\n`);
            this.append(`<table>\n`);
            this.append(`<tr><th>Value</th><th>Description</th></tr>\n`);
            for (const row of rows) {
                this.append(`<tr><td>${row[0]}</td><td>${row[1]}</td></tr>\n`);
            }
            this.append(`</table>\n`);
            this.append(`</emu-table>\n`);
        } else if (enumValues) {
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
        this.append(`<tr><th>Property</th><th>Type</th><th>Requirement</th><th>Description</th></tr>\n`);

        return this;
    }

    addPropertyTableRow(key, type, requiredLabel, description) {
        this.append(`<tr><td>${key}</td><td>${type}</td><td>${requiredLabel}</td><td>${description}</td></tr>\n`);
        return this;
    }

    closePropertiesTable() {
        this.append(`</table>\n`);
        this.append(`</emu-table>\n`);
        return this;
    }

    openArraySection(breadcrumb, title, propertyName, requiredLabel, type, description, appendedDescription) {
        const id = `sec-${breadcrumb.replace(/[^a-zA-Z0-9\-]+/g, "-").toLowerCase()}`;
        this.openSection(id);

        // Add title
        if (title) {
            this.addSectionTitle(title);
        } else if (propertyName) {
            this.append(`<h1>${propertyName}</h1>\n`);
        }

        // Add breadcrumb, property, type, etc.
        if (breadcrumb) {
            this.addLocation(breadcrumb);
        }

        if (propertyName) {
            const requiredStr = requiredLabel ? ` (${requiredLabel})` : "";
            this.append(`<p><strong>Property:</strong> ${propertyName}${requiredStr}</p>\n`);
        }

        if (type) {
            this.append(`<p><strong>Type:</strong> ${type}</p>\n`);
        }

        if (description) {
            let desc = description;
            if (appendedDescription) {
                desc += " " + appendedDescription;
            }
            this.append(`<p><strong>Description:</strong> ${desc}</p>\n`);
        }

        return this;
    }

    addComplexTypeNote(complexTypeLabel) {
        this.addImportantNote(`Must be ${complexTypeLabel}:`);
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
            string = EnglishTranslation.translateToUK(string);
            this.append(`<emu-note><em>${string}</em></emu-note>`);
        }
        this.write();
        return this;
    }

    addNumberedBullet(value) {
        if (value) {
            this.append(`<li>${EnglishTranslation.translateToUK(value)}</li>`);
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
