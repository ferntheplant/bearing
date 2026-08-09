---
type: design
project: mvp
clears: [the-default-tracker-directory-name]
---

# The default tracker directory name

**What should `bearing init` write into a repository that has no opinion?**

This repository's tracker is `.bearing/`, chosen here and not by a rule. The one configuration key means
whatever is chosen is only a default
([Bearing stops at the repo's edge (ADR 0014)](../../docs/adr/0014-bearing-stops-at-the-repos-edge.md)) — and a
default is what almost every repo will keep, so this is a naming decision wearing a configuration disguise.

The candidates and what is wrong with each:

- **`.scratch/`** — the ancestor's name, inherited rather than chosen. Describes the contents honestly (this is
  scratch work, and it gets deleted) but collides with a directory some repos already use for exactly that, and
  a collision here means bearing parses files it did not write.
- **`.bearing/`** — names the tool rather than the contents, which is the thing every other dotfile directory
  does and which nobody finds confusing. Cost: it says nothing about what is inside, and a reader who does not
  know the tool learns nothing from the name.
- Something naming the contents rather than either — `.fog/`, `.tracker/`, `.bearings/` — which trades tool
  recognition for description and reopens the collision risk.

Worth deciding alongside: whether a hidden directory is right at all. The tracker is meant to be read by humans
and edited by hand, and a leading dot hides it from `ls` and from some file pickers — which is the opposite of
what a tool whose whole premise is "the files are yours" wants. The counter-argument is that it sits at the repo
root next to `src/` and `docs/`, and an undotted `tracker/` there is a claim on a very common name.

Settles as an ADR plus a `CONTEXT.md` entry if the chosen name needs one. If the answer is `.bearing/`, the ADR
still has to exist — the name is currently a fact about this repo and not a decision anyone made.
