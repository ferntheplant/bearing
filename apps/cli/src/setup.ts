import { applySetup, planSetup, type PackagedSkill, type SetupOutcome } from "@bearing/core";
import { BunFileSystem, BunPath } from "@effect/platform-bun";
import type { FileSystem, Path } from "effect";
import { Effect } from "effect";

import { packagedSkill } from "./skill.ts";

const runEffect = <A, E>(effect: Effect.Effect<A, E, FileSystem.FileSystem | Path.Path>) =>
  Effect.runPromise(effect.pipe(Effect.provide(BunFileSystem.layer), Effect.provide(BunPath.layer)));

export type SetupRunner = (cwd: string) => Promise<SetupOutcome>;

export const runSetup: SetupRunner = async (cwd) => {
  const skill: PackagedSkill = packagedSkill();
  const plan = await runEffect(planSetup(cwd));
  return runEffect(applySetup(plan, skill));
};
