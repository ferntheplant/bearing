---
type: design
project: mvp
---

# How a repo declares where a durable answer lands

**Does adopting bearing produce a written bridge saying what counts as durable in this repository — and if it
does, who writes it, where does it live, and what stops it becoming the configuration bearing refuses to have?**

[The skill teaches method; the repo supplies the referents (ADR 0037)](../../docs/adr/0037-the-skill-teaches-method-and-the-repo-supplies-the-referents.md)
settled the allocation and left the mechanism open. The skill resolves what counts as durable "by reading what
that repo already keeps and by asking when it finds nothing", and the ask is self-extinguishing: the first
landing creates the structure the next session discovers. That is a good answer for a repo with existing
documentation. It is a weak one for a repo with none, where every session re-derives the same answer by reading
the same absence, and it says nothing about where a repo that has answered the question should write the answer
down.

This repository has now answered it by hand, which is the evidence. `.bearing/README.md` names the five places
an answer may land here, and it exists because a person wrote it, not because anything in bearing asked for it
or knows it is there — acquisition reads `backlog/`, `tickets/`, and `maps/` and ignores everything else at the
tracker root.

**Two things already shipped say that file should not exist.** ADR 0037 lists the repo's referents among what
the skill "points at and never writes", and `x8bq3t` carries the sharper form as a done-when: the skill
"instructs no configuration file and no tracker-side record of the answer". A bridge at the tracker root is a
tracker-side record of the answer. Either that constraint is right and this repository is violating its own
rule, or the constraint was aimed at something narrower — a machine-read config file — and a human-read bridge
was never what it meant to forbid. Which of those is true is the question.

The distinction to get right is between a **record** and a **configuration**. Bearing having no configuration
means the binary reads no settings, discovers no validators, and branches on nothing a repo wrote down
([Bearing stops at the repo's edge (ADR 0014)](../../docs/adr/0014-bearing-stops-at-the-repos-edge.md)). A file
that only a human or an agent reads costs none of that. But a file bearing creates at `init` is one bearing has
an opinion about, and the gap between "creates a stub" and "acquires an opinion about how the repo documents
itself" is exactly where this has to be careful.

Worth deciding against the three cases separately, because they may not share an answer: a repo with rich
existing documentation, a repo with none, and this repo — which is neither, since it wrote its bridge before the
question was asked.

Settles as an ADR, amending ADR 0037 if the allocation holds and only the mechanism was missing. It reaches the
wayfinder skill's text and contradicts one of its stated done-whens, which is why it blocks `x8bq3t`.
