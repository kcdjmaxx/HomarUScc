# Test Design: AgentRegistry
**Source:** crc-AgentRegistry.md

## Test: register adds agent
**Purpose:** Verify agent registration succeeds under capacity
**Input:** register("id1", "research task", "/tmp/out.txt") with maxConcurrent=3
**Expected:** getAll() returns 1 agent with status "running"
**Refs:** crc-AgentRegistry.md

## Test: register rejects at capacity
**Purpose:** Verify concurrency limit is enforced
**Input:** Register 3 agents, then attempt a 4th with maxConcurrent=3
**Expected:** 4th register() returns false
**Refs:** crc-AgentRegistry.md

## Test: complete emits event
**Purpose:** Verify agent completion emits agent_completed event
**Input:** Register agent, then complete("id1", "results here")
**Expected:** Emitter called with event type "agent_completed", agent status changes to "completed"
**Refs:** crc-AgentRegistry.md

## Test: fail emits event
**Purpose:** Verify agent failure emits agent_failed event
**Input:** Register agent, then fail("id1", "error message")
**Expected:** Emitter called with event type "agent_failed", agent status changes to "failed"
**Refs:** crc-AgentRegistry.md

## Test: cleanup removes agent
**Purpose:** Verify completed agents are cleaned up
**Input:** Register, complete, cleanup("id1")
**Expected:** getAll() returns empty, getAvailableSlots() returns maxConcurrent
**Refs:** crc-AgentRegistry.md

## Test: getAvailableSlots counts correctly
**Purpose:** Verify slot calculation
**Input:** maxConcurrent=3, register 2 agents
**Expected:** getAvailableSlots() returns 1
**Refs:** crc-AgentRegistry.md
