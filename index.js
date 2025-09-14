import { EcmarkupGenerator } from "./lib/EcmarkupGenerator.js";
import fs from "node:fs";
import { setTimeout } from "node:timers/promises";
import $RefParser from "@apidevtools/json-schema-ref-parser";
import beautify from "js-beautify";

const cdxSchema = "schemas/bom-1.7.schema.json";
const specPath = "spec.html";

// Tags to skip during formatting
const TAGS_TO_SKIP = ["pre", "code", "script"];

function extractAndReplaceSections(html, tags) {
  const replacements = {};
  let counter = 0;

  tags.forEach(tag => {
    const regex = new RegExp(`<${tag}[^>]*?>[\\s\\S]*?<\\/${tag}>`, "gi");
    html = html.replace(regex, match => {
      const key = `__PLACEHOLDER__${tag.toUpperCase()}__${counter++}__`;
      replacements[key] = match;
      return key;
    });
  });
  return { html, replacements };
}

function restoreSections(html, replacements) {
  for (const [key, value] of Object.entries(replacements)) {
    html = html.replace(key, value);
  }
  return html;
}

async function parseSchema() {
  try {
    return await $RefParser.dereference(cdxSchema, {
      dereference: {
        circular: "ignore",
        preservedProperties: ["title", "description"]
      }
    });
  } catch (err) {
    console.log(err);
  }
}

async function generateAndFormat() {
  const schema = await parseSchema();
  const writer = fs.createWriteStream(specPath);
  const gen = new EcmarkupGenerator(schema, writer);

  writer.on("finish", async () => {
    await formatSpec();
  });

  setTimeout(1000).then(() => {
    if (!writer.closed) writer.end();
  });
}

async function formatSpec() {
  try {
    const raw = await fs.promises.readFile(specPath, "utf8");

    // Step 1: Extract and replace protected tags
    const { html: placeholdered, replacements } = extractAndReplaceSections(raw, TAGS_TO_SKIP);

    // Step 2: Beautify the rest
    const pretty = beautify.html(placeholdered, {
      indent_size: 2,
      preserve_newlines: false,
      max_preserve_newlines: 1,
      wrap_line_length: 0,
      end_with_newline: true
    });

    // Step 3: Restore unformatted sections
    const restored = restoreSections(pretty, replacements);

    await fs.promises.writeFile(specPath, restored, "utf8");
    console.log(specPath + " written and formatted");
  } catch (err) {
    console.error("Pretty-print failed:", err);
  }
}

generateAndFormat();
