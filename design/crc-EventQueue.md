# EventQueue
**Requirements:** R2, R9

## Knows
- queue: array of events sorted by priority
- maxSize: maximum queue depth (default 1000)
- overflowStrategy: drop_lowest, delay, or reject

## Does
- enqueue: add event, insert by priority, handle overflow
- dequeue: remove and return highest-priority event
- peek: view next event without removing
- size: current queue depth
- clear: drain all events, return them

## Collaborators
- HomarUScc: enqueues and dequeues events

## Sequences
- seq-event-flow.md
