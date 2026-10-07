# Session TTL and clear-session

Durable Object memory lasts 24 hours, then it is wiped. The chat UI also has a control that drops the session immediately.

## Clock

`expiresAt` is 24 hours after the last successful `POST /session/:id/message`. A newer message replaces `lastReport`, `packetHash`, and `expiresAt`. It does not stack time on top of the old expiry.

On every read, if `expiresAt` is in the past, delete the stored state before doing anything else. Also schedule a Durable Object alarm at `expiresAt` that deletes the same state. The read check still runs, so a late alarm does not leave the session in place.

Wiped means the hash, the last report, and `expiresAt` are gone. There is no resume text to delete, because `SessionState` does not store it. See [api-contract.md](./api-contract.md).

State that fails `SessionState` is wiped the same way. It is not repaired.

## Clear-session control

The Pages chat shows a control labeled "Clear session". It is visible while a session id exists. It does not ask for a second confirmation.

The click sends `POST /session/:id/clear`. When the response is `{ "cleared": true }`, the page drops the visible transcript and the session id. A failed call leaves the transcript on screen and shows a short error.

Clear does not wait for the 24-hour alarm. It deletes the Durable Object state in that request.

## Tests

One test writes a session, moves the clock past 24 hours, reads it, and finds an empty object. One test calls clear-session and finds an empty object before 24 hours.
