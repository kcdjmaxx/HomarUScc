# ref-telegram-bot-api

- **Source:** https://core.telegram.org/bots/api
- **Type:** web
- **Fetched:** 2026-02-19
- **Requirements:** TBD
- **Status:** active
- **Summary:** Telegram Bot API provides getUpdates (long-polling), sendMessage, and getMe methods. Updates arrive as objects with unique update_id containing at most one event type (message, edited_message, etc.). Messages have metadata (message_id, date, chat), content fields (text, entities), and reply context. HomarUScc uses getUpdates polling with exponential backoff.
