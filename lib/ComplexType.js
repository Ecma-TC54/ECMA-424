export class ComplexType {
    // Private Fields
    static #_ANY_OF = { "property": "anyOf", "label": "any of" };
    static #_ONE_OF = { "property": "oneOf", "label": "one of" };
    static #_ALL_OF = { "property": "allOf", "label": "all of" };

    // Accessors for "get" functions only (no "set" functions)
    static get ANY_OF() { return this.#_ANY_OF; }
    static get ONE_OF() { return this.#_ONE_OF; }
    static get ALL_OF() { return this.#_ALL_OF; }
}
