import { Effect, FileSystem, Layer, Path, PlatformError } from "effect";

export type FsEntry =
  | { readonly type: "directory" }
  | { readonly type: "file"; readonly content: string }
  | { readonly type: "link"; readonly target: string };

export const directory = (): FsEntry => ({ type: "directory" });
export const file = (content: string): FsEntry => ({ type: "file", content });
export const link = (target: string): FsEntry => ({ type: "link", target });

const normalize = (path: string): string => {
  const segments = path.split("/").filter((segment) => segment !== "" && segment !== ".");
  const out: string[] = [];
  for (const segment of segments) {
    if (segment === "..") {
      out.pop();
    } else {
      out.push(segment);
    }
  }
  return out.length === 0 ? "/" : `/${out.join("/")}`;
};

const dirname = (path: string): string => {
  const index = path.lastIndexOf("/");
  return index <= 0 ? "/" : path.slice(0, index);
};

const notFound = (method: string, path: string) =>
  PlatformError.systemError({ _tag: "NotFound", module: "FileSystem", method, pathOrDescriptor: path });

const invalid = (method: string, path: string) =>
  PlatformError.systemError({ _tag: "InvalidData", module: "FileSystem", method, pathOrDescriptor: path });

const alreadyExists = (method: string, path: string) =>
  PlatformError.systemError({ _tag: "AlreadyExists", module: "FileSystem", method, pathOrDescriptor: path });

export interface InjectedFailure {
  readonly operation: "make-directory" | "write-file" | "remove";
  readonly path: string;
}

export class Harness {
  readonly entries: Map<string, FsEntry>;

  constructor(
    entries: Readonly<Record<string, FsEntry>>,
    readonly failure?: InjectedFailure,
    readonly afterMakeDirectory?: (path: string) => void,
  ) {
    this.entries = new Map();
    for (const [path, entry] of Object.entries(entries)) {
      this.entries.set(normalize(path), entry);
    }
    for (const path of this.entries.keys()) {
      let parent = dirname(path);
      while (parent !== "/") {
        if (!this.entries.has(parent)) {
          this.entries.set(parent, directory());
        }
        parent = dirname(parent);
      }
    }
  }

  /** Resolves symlinks along every component, node-style. */
  resolve(path: string): string {
    const segments = normalize(path).split("/").filter(Boolean);
    let resolved = "/";
    for (const segment of segments) {
      const candidate = resolved === "/" ? `/${segment}` : `${resolved}/${segment}`;
      const entry = this.entries.get(candidate);
      if (entry?.type === "link") {
        const target = entry.target ?? "";
        const linked = target.startsWith("/") ? target : `${dirname(candidate)}/${target}`;
        resolved = this.resolve(linked);
      } else {
        resolved = candidate;
      }
    }
    return resolved;
  }

  fails(operation: InjectedFailure["operation"], path: string): boolean {
    return this.failure?.operation === operation && normalize(this.failure.path) === normalize(path);
  }
}

const makeMethods = (harness: Harness): Partial<FileSystem.FileSystem> => ({
  exists: (path) =>
    Effect.sync(() => {
      try {
        return harness.entries.has(harness.resolve(path));
      } catch {
        return false;
      }
    }),
  stat: (path) =>
    Effect.gen(function* () {
      const physical = yield* Effect.sync(() => harness.resolve(path));
      const entry = harness.entries.get(physical);
      if (entry === undefined) {
        return yield* Effect.fail(notFound("stat", path));
      }
      return {
        type: entry.type === "directory" ? "Directory" : entry.type === "file" ? "File" : entry.type,
      } as FileSystem.File.Info;
    }),
  readDirectory: (path) =>
    Effect.gen(function* () {
      const physical = yield* Effect.sync(() => harness.resolve(path));
      const entry = harness.entries.get(physical);
      if (entry === undefined || entry.type !== "directory") {
        return yield* Effect.fail(notFound("readDirectory", path));
      }
      const prefix = physical === "/" ? "/" : `${physical}/`;
      const names = new Set<string>();
      for (const key of harness.entries.keys()) {
        if (key.startsWith(prefix)) {
          const rest = key.slice(prefix.length);
          if (rest.length > 0 && !rest.includes("/")) {
            names.add(rest);
          }
        }
      }
      return [...names];
    }),
  readFileString: (path) =>
    Effect.gen(function* () {
      const physical = yield* Effect.sync(() => harness.resolve(path));
      const entry = harness.entries.get(physical);
      if (entry === undefined || entry.type !== "file") {
        return yield* Effect.fail(notFound("readFileString", path));
      }
      return entry.content;
    }),
  readLink: (path) =>
    Effect.gen(function* () {
      const entry = harness.entries.get(normalize(path));
      if (entry === undefined) {
        return yield* Effect.fail(notFound("readLink", path));
      }
      if (entry.type !== "link") {
        return yield* Effect.fail(invalid("readLink", path));
      }
      return entry.target;
    }),
  makeDirectory: (path) =>
    harness.fails("make-directory", path)
      ? Effect.fail(invalid("makeDirectory", path))
      : Effect.sync(() => {
          harness.entries.set(normalize(path), directory());
          harness.afterMakeDirectory?.(normalize(path));
        }),
  writeFileString: (path, data, options) =>
    Effect.gen(function* () {
      if (harness.fails("write-file", path)) {
        return yield* Effect.fail(invalid("writeFileString", path));
      }
      const physical = yield* Effect.sync(() => harness.resolve(path));
      if (options?.flag === "wx" && harness.entries.has(physical)) {
        return yield* Effect.fail(alreadyExists("writeFileString", path));
      }
      harness.entries.set(physical, file(data));
    }),
  remove: (path) =>
    harness.fails("remove", path)
      ? Effect.fail(invalid("remove", path))
      : Effect.sync(() => {
          const normalized = normalize(path);
          harness.entries.delete(normalized);
          for (const key of harness.entries.keys()) {
            if (key.startsWith(`${normalized}/`)) {
              harness.entries.delete(key);
            }
          }
        }),
});

export const layer = (harness: Harness) => Layer.merge(FileSystem.layerNoop(makeMethods(harness)), Path.layer);
