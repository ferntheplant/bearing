import type { PackagedSkill } from "@bearing/core";
import { skillFiles } from "virtual:bearing-skill";

import { BEARING_VERSION } from "./version.ts";

export const packagedSkill = (): PackagedSkill => ({
  version: BEARING_VERSION,
  files: [...skillFiles].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
});
