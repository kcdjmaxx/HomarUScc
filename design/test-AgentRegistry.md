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

## Test: polling detects completion marker
**Purpose:** Verify file tail is checked for completion markers
**Input:** Register agent with outputFile, write file containing `"stop_reason":"end_turn"` in last 512 bytes, call pollAgents()
**Expected:** Agent status changes to "completed", agent_completed event emitted
**Refs:** crc-AgentRegistry.md, seq-agent-poll.md

## Test: polling detects stable mtime
**Purpose:** Verify stable mtime detection completes agent
**Input:** Register agent with outputFile, write file with content, set mtime to 15 seconds ago, call pollAgents()
**Expected:** Agent status changes to "completed", agent_completed event emitted
**Refs:** crc-AgentRegistry.md, seq-agent-poll.md

## Test: polling skips missing file
**Purpose:** Verify ENOENT is handled gracefully
**Input:** Register agent with outputFile pointing to non-existent path, call pollAgents()
**Expected:** Agent remains "running", no error thrown
**Refs:** crc-AgentRegistry.md, seq-agent-poll.md

## Test: polling skips already completed agent
**Purpose:** Verify no duplicate completion events
**Input:** Register agent, complete it manually, call pollAgents()
**Expected:** Emitter called only once (from manual complete), not again from poll
**Refs:** crc-AgentRegistry.md, seq-agent-poll.md

## Test: stopPolling clears interval
**Purpose:** Verify polling does not keep process alive
**Input:** startPolling(), then stopPolling()
**Expected:** pollTimer is null, no further poll cycles execute
**Refs:** crc-AgentRegistry.md, seq-agent-poll.md
