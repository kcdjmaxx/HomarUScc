# DashboardAdapter
**Requirements:** R23

## Knows
- outboundHandler: function to send messages back to dashboard WebSocket clients

## Does
- connect: no-op (always connected while server runs)
- disconnect: no-op
- send: call outboundHandler to push message to WebSocket clients
- health: always healthy
- receiveFromDashboard: normalize dashboard chat message to Event, deliver to loop
- setOutboundHandler: wire up the WebSocket broadcast function

## Collaborators
- ChannelAdapter: base class
- DashboardServer: provides WebSocket bridge
- ChannelManager: lifecycle

## Sequences
- seq-event-flow.md
