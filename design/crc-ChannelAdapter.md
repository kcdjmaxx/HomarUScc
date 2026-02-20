# ChannelAdapter
**Requirements:** R16, R17, R18

## Knows
- name: channel identifier
- state: disconnected | connecting | connected | error
- dmPolicy: pairing | allowlist | open | disabled
- groupPolicy: mention_required | always_on | disabled
- messageHandler: callback for inbound messages

## Does
- connect: establish connection (abstract)
- disconnect: close connection (abstract)
- send: deliver outbound message (abstract)
- health: return health status (abstract)
- onMessage: register inbound callback
- checkAccess: enforce DM and group policies on inbound messages
- normalizeInbound: convert raw payload to standard Event
- deliver: call handler after access check passes

## Collaborators
- ChannelManager: lifecycle management

## Sequences
- seq-event-flow.md
