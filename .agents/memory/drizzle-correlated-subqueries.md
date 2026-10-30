---
name: Correlated Drizzle subqueries
description: Single-table selects can silently remove the outer column qualifier in SQL expressions
---

In a correlated scalar SQL expression inside a single-table Drizzle select, use
explicit SQL identifiers for the outer table and column, and inspect the complete
generated SELECT rather than just compiling the inner expression.

**Why:** Drizzle's single-table selection rewriting removed the table qualifier
from an interpolated outer Column. PostgreSQL then bound the bare `id` to the
inner file table, so an otherwise valid first-upload preview query returned null
for every project without reporting an error. The same expression compiled alone
still looked correct, which hid the problem from an initial unit test.

**How to apply:** Add regression assertions against the complete query's
`toSQL()` output (a Drizzle mock can compile it without database access). Use
fixed, trusted SQL identifiers for correlated outer references; never interpolate
user input as an identifier.
