# Concurrency Explainer

**Your name:** Antigravity
**Date:** 2024-04-28

---

## The Root Cause — Why Check-Then-Insert Fails

In the context of a high-traffic ticketing system, a race condition occurs when multiple requests attempt to perform the same action on a shared resource simultaneously. The "check-then-insert" pattern is a classic example of this flaw. Specifically, the application first performs a `findFirst()` query to see if a seat is already booked, and if it receives a null result, it proceeds to call `create()` to insert a new booking.

The fundamental problem is the "gap" or time-of-check to time-of-use (TOCTOU) vulnerability between these two operations. If two users, Alice and Bob, both try to book the same seat at the exact same millisecond, both of their `findFirst()` checks might execute before either one has committed a new record. Since neither check sees an existing booking, both Alice's and Bob's requests proceed to the `create()` step. This results in the same seat being double-booked, even though the application logic "checked" for it.

---

## Why the Unique Constraint Fixes It

Moving the uniqueness check from the application layer to the database layer via a `@@unique([seatId, showId])` constraint solves the race condition by making the uniqueness check atomic. Database engines are designed to handle concurrent transactions using locks and internal consistency mechanisms that the application code cannot easily replicate. 

When the database attempts to insert the second booking, it checks the unique index. Because the index update is part of the same atomic operation as the insert, the database can guarantee that if a record already exists with that specific `seatId` and `showId`, the second insert will fail immediately. This closes the "gap" because the check happens at the exact moment of the write, leaving no room for another request to slip in between.

---

## Why Rate Limiting Alone Is Not Enough

Rate limiting is an essential defense layer that prevents flooding and resource exhaustion (DoS protection), but it does not address the underlying logic of a race condition. A rate limiter might restrict a single IP to 10 requests per minute, but it doesn't stop two different users from two different IPs from hitting the endpoint at the same time.

For example, Alice and Bob are two separate fans. They both send exactly one request the moment the sale opens. They are both well within the rate limit. However, without a unique constraint, their requests could still hit the database simultaneously and trigger the race condition described above. Rate limiting stops the volume, but only database constraints stop the race.

---

## What P2002 Means and Why 409

In Prisma, the error code `P2002` indicates a "Unique constraint failed on the constraint: {constraint}". This is a specific signal from the database that we tried to insert data that violates a uniqueness rule. 

Returning a `409 Conflict` status is the most appropriate response because it accurately describes what happened: the request could not be completed due to a conflict with the current state of the resource (the seat is already taken). A `400 Bad Request` would imply the client sent malformed data, which isn't true—the data was valid, it just wasn't "first." A `500 Internal Server Error` would be misleading because it suggests a bug or server failure, whereas a constraint violation in this context is an expected and handled business scenario.

---

**Total word count:** ~520 words
