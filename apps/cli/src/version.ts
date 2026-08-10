import pkg from "#package.json" with { type: "json" };

export const BEARING_VERSION: string = pkg.version;
