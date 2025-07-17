const map = new Map();
map.set("date-time", "data-time as specified in [RFC 3339 section 5.6](https://www.ietf.org/rfc/rfc3339.html#section-5.6)");
map.set("time", "time as specified in [RFC 3339 section 5.6](https://www.ietf.org/rfc/rfc3339.html#section-5.6)");
map.set("date", "date as specified in [RFC 3339 section 5.6](https://www.ietf.org/rfc/rfc3339.html#section-5.6)");
map.set("email", "email address as specified in [RFC 5321, section 4.1.2](https://www.ietf.org/rfc/rfc5321.html#section-4.1.2)");
map.set("idn-email", "idn-email address as specified in [RFC 6531](https://www.ietf.org/rfc/rfc6531.html)");
map.set("uri", "uri as specified in [RFC 3986](https://www.ietf.org/rfc/rfc3986.html)");
map.set("uri-reference", "uri-reference as specified in [RFC 3986](https://www.ietf.org/rfc/rfc3986.html#section-4.1)");
map.set("iri", "iri as specified in [RFC 3987](https://www.ietf.org/rfc/rfc3987.html)");
map.set("iri-reference", "iri-reference as specified in [RFC 3987](https://www.ietf.org/rfc/rfc3987.html)");
map.set("regex", "a regular expression, which should be valid according to the [ECMA 262](https://www.ecma-international.org/publications-and-standards/standards/ecma-262/) dialect");

export class Format {

    constructor() {
    }

    static description(format) {
        if (map.has(format)) {
            return map.get(format);
        } else {
            throw new Error("Unsupported JSON format: " + format);
        }
    }
}
