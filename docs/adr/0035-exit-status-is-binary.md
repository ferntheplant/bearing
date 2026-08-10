# Exit status is binary

Bearing returns zero when the requested operation succeeds and one when it does not. A valid no-op and an
integrity check containing warnings but no errors succeed; invalid usage, a refused operation, integrity errors,
an ambiguous id, malformed tracker content, and an operational failure all fail.

More status classes would let shell callers distinguish some failures without reading output, but would turn
those distinctions into a permanent second error interface alongside bearing's rendered or structured
diagnostics. The primary caller already reads that output, so exit status answers only whether the command
succeeded.
