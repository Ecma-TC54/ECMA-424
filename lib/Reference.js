/*
Lookup table has the following syntax:
[0] = JSON Schema definition
[1] = Origin breadcrumb
[2] = Description to use elsewhere if not the origin
[3] = (optional) the property name to replace
[4] = (optional) an alternate description of the property
*/
const lookupTable = [
    ["#/definitions/component", "/components/[]", "Refer to the component definition at /components/[]"],
    ["#/definitions/service", "/services/[]", "Refer to the service definition at /services/[]"],
    ["#/definitions/licenseChoice", "/components/[]/licenses", "Refer to the license definition at /components/[]/licenses", "/licenses"],
    ["#/definitions/externalReference", "/externalReference", "Refer to the external reference definition at /externalReferences/[]", "/externalReference"],
    ["#/definitions/externalReference", "/externalReferences", "Refer to the external reference definition at /externalReferences/[]", "/externalReferences"],
    ["#/definitions/signature", null, "Refer to the JSON Signature Format specification or to the XML Signature specification for implementation details.</p><ul><li>https://cyberphone.github.io/doc/security/jsf.html</li><li>https://www.w3.org/TR/xmldsig-core/</li></ul>", "/signature", "An enveloped digital signature embedded within and specific to this object within the BOM. CycloneDX signatures enable integrity and authenticity verification without separating the signature from the BOM. Enveloped signatures enable each party in the supply chain to take responsibility for and sign their specific data, ensuring its integrity and authenticity. By aggregating all signatures, stakeholders can independently verify discrete pieces of information from each provider, enhancing overall transparency and trust in the supply chain."]
]

export class Reference {

    constructor() {
    }

    static lookup(string) {
        for (const array of lookupTable) {
            if (array.indexOf(string) > -1) {
                return array;
            }
        }
    }

    static fuzzyLookup(string) {
        for (const array of lookupTable) {
            if (string && array[3]) {
                if (string.endsWith(array[3])) {
                    return array;
                }
            }
        }
    }

}
