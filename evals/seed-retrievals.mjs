#!/usr/bin/env node
// Seed the retrieval_log with diverse searches to build up history
const API = "http://127.0.0.1:3120/api/tool-call";

const QUERIES = [
  "user preferences communication style", "morning briefing timer", "gmail imap connection",
  "sqlite-vec embedding binding", "telegram bot token", "zoho calendar api",
  "dream cycle overnight", "prediction error logging", "identity soul file",
  "fric and frac restaurant", "eth trading strategy", "compaction identity files",
  "hiring pipeline applicant", "needoh inventory target", "sonic pi music",
  "memory search hybrid vector", "dashboard websocket events", "timer schedule cron",
  "email safety untrusted input", "agent dispatch background", "journal daily reflection",
  "soul evolution self", "touchdesigner nodes", "record collection vinyl",
  "obsidian vault tags", "calendar event zoho create", "whoop recovery workout",
  "spaces buckets priorities", "goatcounter analytics portfolio", "sportsengine ical sync",
  "keystone innovation wednesday", "bisociation creative connections", "dream decay weight",
  "max phone number twilio", "hal ec2 openclaw", "syncthing halshare files",
  "progressive disclosure search", "retrieval log tracking", "autoresearch experiments",
  "build skill pipeline phases", "compact identity limits", "measure metrics baseline",
  "review code security", "transcribe audio whisper", "verify fact check claims",
  "crm contact search", "home assistant lights", "browser navigate screenshot",
  "prediction errors weekly reconsolidation", "session checkpoint compaction",
];

async function seed() {
  let total = 0;
  for (const query of QUERIES) {
    try {
      await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "memory_search", args: { query, limit: 5, detail: "index" } }),
      });
      total++;
    } catch { /* skip */ }
  }
  console.log(JSON.stringify({ seeded: total, queries: QUERIES.length }));
}

seed();
