# TelegramChannelAdapter
**Requirements:** R19, R20, R21, R22
**Refs:** ref-telegram-bot-api

## Knows
- token: bot API token
- botUsername: resolved via getMe
- offset: last processed update_id + 1
- recentMessages: circular buffer of last 50 messages
- allowedChatIds: optional whitelist
- backoffMs: current exponential backoff delay
- polling: whether poll loop is active

## Does
- connect: call getMe to resolve username, start poll loop
- disconnect: stop poll loop
- send: call sendMessage API
- health: report polling status
- poll: call getUpdates, process each message, backoff on error
- handleMessage: normalize Telegram message to MessagePayload, check access, deliver
- detectMention: scan entities for bot_command or text_mention matching botUsername
- getRecentMessages: return buffered messages for telegram_read tool
- apiCall: generic Telegram Bot API HTTP call

## Collaborators
- ChannelAdapter: base class
- ChannelManager: lifecycle

## Sequences
- seq-event-flow.md
