# Only design-ticket closing is a dry run

Closing a design ticket is the only mutation that changes nothing on its first invocation and applies on a
re-run. Every other mutation plans and applies within one invocation. Bearing still has no interactive prompts
outside first-time setup: the design-close dry run is output followed by a separate command, never a question
waiting on stdin.

A second look earns its cost only for a design close, where bearing can check that a trail outcome exists but
cannot judge whether the human-authored outcome is true or useful. Showing that row verbatim before deletion
puts the unautomatable bookkeeping on screen. Creation, triage, retitle, removal, build close, and map close are
fully described by their command and repository diff; previewing them adds ceremony without new information.

## Consequences

Every mutation retains separate planning and applying operations inside core. A direct mutation runs both in
one process, so generated ids need no persistence between invocations. A bare design close runs only its plan;
the deliberately undocumented applying flag runs the plan and then applies it.
