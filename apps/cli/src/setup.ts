import { applySetup, planSetup, resolveSetupDestination, type PackagedSkill, type SetupOutcome } from "@bearing/core";
import { BunFileSystem, BunPath, BunTerminal } from "@effect/platform-bun";
import type { FileSystem, Path } from "effect";
import { Effect, Layer } from "effect";
import { Prompt } from "effect/unstable/cli";

import { packagedSkill } from "./skill.ts";

export type AskDestination = (candidates: readonly string[]) => Promise<string>;

export const promptDestination: AskDestination = (candidates) => {
  const select = Prompt.select({
    message: "Both .agents/skills and .claude/skills exist. Where should bearing install its skill?",
    choices: candidates.map((label) => ({ title: label, value: label })),
  });
  return Effect.runPromise(
    Effect.provide(select, Layer.merge(BunFileSystem.layer, Layer.merge(BunPath.layer, BunTerminal.layer))),
  );
};

const runEffect = <A, E>(effect: Effect.Effect<A, E, FileSystem.FileSystem | Path.Path>) =>
  Effect.runPromise(effect.pipe(Effect.provide(BunFileSystem.layer), Effect.provide(BunPath.layer)));

export const runSetup = async (cwd: string, ask: AskDestination): Promise<SetupOutcome> => {
  const skill: PackagedSkill = packagedSkill();
  const plan = await runEffect(planSetup(cwd));
  const label =
    plan.skill.tag === "choose" ? await ask(plan.skill.candidates.map((candidate) => candidate.label)) : undefined;
  return runEffect(applySetup(resolveSetupDestination(plan, label), skill));
};
