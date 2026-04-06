---
name: transcribe
description: Transcribe audio or video locally using mlx-whisper on Apple Silicon. Produces a markdown transcript file. TRIGGER when user says "transcribe this", "what does this audio say", "transcribe the video", provides a YouTube URL for transcription, or sends a voice message to transcribe. Supports YouTube URLs, local files, and Telegram voice messages. Invoked with /transcribe.
---

# Transcribe

Local audio/video transcription using Apple Silicon-optimized whisper models. No cloud APIs.

## Usage

When the user invokes `/transcribe`, they will provide one of:
- A YouTube URL
- A local file path (audio or video)
- A reference to a Telegram voice message

## Pipeline

### 1. Identify the source

- **YouTube URL**: Download audio with yt-dlp
- **Local file**: Use directly
- **Telegram voice message**: File is already downloaded to `~/.homaruscc/telegram-media/`

### 2. Download (YouTube only)

```bash
yt-dlp -x --audio-format wav -o "/tmp/transcribe-%(id)s.%(ext)s" "<URL>"
```

If `yt-dlp` isn't found, tell the user to install it: `brew install yt-dlp`

### 3. Transcribe with mlx-whisper

```python
python3 -c "
import mlx_whisper
result = mlx_whisper.transcribe('<audio_file>', path_or_hf_repo='mlx-community/whisper-large-v3-turbo', language='en')
print(result['text'])
"
```

**Model selection:**
- Default: `mlx-community/whisper-large-v3-turbo` (best quality, still fast on Apple Silicon)
- Fast/short clips: `mlx-community/whisper-base-mlx` (use for voice messages under 30s)
- If user requests speed over accuracy, use base model

**Fallback chain:** mlx-whisper -> faster-whisper -> whisper-cli (whisper-cpp)

If mlx-whisper isn't installed: `pip3 install mlx-whisper`

### 4. Save output

- **YouTube transcripts**: Save to `ClawdBot/HalShare/transcripts/<date>-<video-id>.md` with frontmatter:
  ```markdown
  # <Video Title>

  **Video:** <URL>
  **Video ID:** <id>
  **Source:** mlx-whisper (local)
  **Model:** <model used>
  **Date extracted:** <YYYY-MM-DD>

  ---

  <transcript text>
  ```
- **Local file transcripts**: Save next to the source file as `<filename>.transcript.md`, or to `/tmp/` if the source is in a read-only location
- **Telegram voice messages**: Return the text inline (don't save unless asked)

### 5. Report

- Tell the user the transcript is done
- For long transcripts (>2000 chars), provide a brief summary and the file path
- For short transcripts, include the full text inline

## Notes

- All transcription happens locally on Apple Silicon using MLX
- For videos longer than ~2 hours, dispatch to a background agent to stay responsive
- The `language` parameter defaults to English; ask if the content might be in another language
