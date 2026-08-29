# Generate Session Digests on Demand Outside Session Logs

A Session Digest is generated only after an explicit action in the Session Inspector. The Host inspects the addressed Session, runs a separate auxiliary model request, and caches the result by source revision. The digest remains a read-only projection: it is never appended to the Session log, never changes Session Lineage, and becomes stale when newer activity appears. This keeps model cost and disclosure intentional while allowing any Selected Session—not only the Viewed Session—to be summarized.
