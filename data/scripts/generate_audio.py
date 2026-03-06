#!/usr/bin/env python3
"""
Batch audio generator for LearnE English vocabulary app.

Reads word entries from a JSON file and generates 6 audio files per word
using edge-tts (Microsoft Edge Text-to-Speech):
  - word (English)           -> audio/words/{word}.mp3
  - meaning (Chinese)        -> audio/meanings/{word}_meaning.mp3
  - phrase (English)         -> audio/phrases/{word}_phrase.mp3
  - phrase_meaning (Chinese) -> audio/phrase_meanings/{word}_phrase_meaning.mp3
  - example (English)        -> audio/examples/{word}_example.mp3
  - example_meaning (Chinese)-> audio/example_meanings/{word}_example_meaning.mp3

Usage:
    python generate_audio.py
    python generate_audio.py --limit 10
    python generate_audio.py --word abandon
    python generate_audio.py --concurrency 3 --input /path/to/words.json
"""

import argparse
import asyncio
import json
import os
import sys
import traceback

import edge_tts

# Voice constants
VOICE_EN = "en-US-JennyNeural"
VOICE_ZH = "zh-CN-XiaoxiaoNeural"

# Audio subdirectory definitions: (json_field, voice, subdirectory, filename_suffix)
AUDIO_TASKS = [
    ("word",             VOICE_EN, "words",            ""),
    ("meaning",          VOICE_ZH, "meanings",          "_meaning"),
    ("phrase",           VOICE_EN, "phrases",            "_phrase"),
    ("phrase_meaning",   VOICE_ZH, "phrase_meanings",    "_phrase_meaning"),
    ("example",          VOICE_EN, "examples",           "_example"),
    ("example_meaning",  VOICE_ZH, "example_meanings",   "_example_meaning"),
]


class Stats:
    """Thread-safe statistics tracker."""

    def __init__(self):
        self.generated = 0
        self.skipped = 0
        self.failed = 0
        self.lock = asyncio.Lock()

    async def add_generated(self, count=1):
        async with self.lock:
            self.generated += count

    async def add_skipped(self, count=1):
        async with self.lock:
            self.skipped += count

    async def add_failed(self, count=1):
        async with self.lock:
            self.failed += count


async def generate_single_audio(text: str, voice: str, output_path: str, stats: Stats) -> bool:
    """
    Generate a single audio file using edge-tts.

    Args:
        text: The text to synthesize.
        voice: The edge-tts voice identifier.
        output_path: Absolute path for the output .mp3 file.
        stats: Stats tracker instance.

    Returns:
        True if file was generated or already existed, False on failure.
    """
    # Skip if the file already exists (resumable generation)
    if os.path.exists(output_path):
        await stats.add_skipped()
        return True

    # Ensure the parent directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    try:
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(output_path)
        await stats.add_generated()
        return True
    except Exception as e:
        print(f"  ERROR generating {output_path}: {e}", file=sys.stderr)
        # Remove partial file if it was created
        if os.path.exists(output_path):
            try:
                os.remove(output_path)
            except OSError:
                pass
        await stats.add_failed()
        return False


async def process_word(
    word_entry: dict,
    index: int,
    total: int,
    output_dir: str,
    semaphore: asyncio.Semaphore,
    stats: Stats,
) -> None:
    """
    Process a single word entry: generate all 6 audio files.

    Args:
        word_entry: Dictionary with word data fields.
        index: 1-based index of the current word.
        total: Total number of words to process.
        output_dir: Base output directory for audio files.
        semaphore: Concurrency-limiting semaphore.
        stats: Stats tracker instance.
    """
    async with semaphore:
        word = word_entry.get("word", "")
        if not word:
            print(f"[{index}/{total}] WARNING: Skipping entry with no 'word' field.")
            return

        all_ok = True
        for field, voice, subdir, suffix in AUDIO_TASKS:
            text = word_entry.get(field, "")
            if not text:
                print(
                    f"  WARNING: Word '{word}' has no '{field}' field, skipping this audio.",
                    file=sys.stderr,
                )
                await stats.add_failed()
                all_ok = False
                continue

            filename = f"{word}{suffix}.mp3"
            output_path = os.path.join(output_dir, subdir, filename)
            success = await generate_single_audio(text, voice, output_path, stats)
            if not success:
                all_ok = False

        status = "Generated audio for" if all_ok else "Partially generated audio for"
        print(f"[{index}/{total}] {status}: {word}")


async def main_async(args: argparse.Namespace) -> None:
    """Main async entry point."""
    input_path = args.input
    output_dir = args.output_dir
    concurrency = args.concurrency
    limit = args.limit
    single_word = args.word

    # Load word entries
    print(f"Loading words from: {input_path}")
    try:
        with open(input_path, "r", encoding="utf-8") as f:
            words = json.load(f)
    except FileNotFoundError:
        print(f"ERROR: Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON in {input_path}: {e}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(words, list):
        print("ERROR: Expected a JSON array of word entries.", file=sys.stderr)
        sys.exit(1)

    # Filter to a single word if requested
    if single_word:
        words = [w for w in words if w.get("word") == single_word]
        if not words:
            print(f"ERROR: Word '{single_word}' not found in {input_path}", file=sys.stderr)
            sys.exit(1)
        print(f"Processing single word: {single_word}")

    # Apply limit
    if limit is not None and limit > 0:
        words = words[:limit]

    total = len(words)
    print(f"Total words to process: {total}")
    print(f"Output directory: {output_dir}")
    print(f"Concurrency limit: {concurrency}")
    print("-" * 50)

    # Create all subdirectories upfront
    for _, _, subdir, _ in AUDIO_TASKS:
        os.makedirs(os.path.join(output_dir, subdir), exist_ok=True)

    # Process all words with concurrency control
    stats = Stats()
    semaphore = asyncio.Semaphore(concurrency)

    tasks = [
        process_word(word_entry, i + 1, total, output_dir, semaphore, stats)
        for i, word_entry in enumerate(words)
    ]
    await asyncio.gather(*tasks)

    # Print summary
    print("-" * 50)
    print("SUMMARY")
    print(f"  Generated : {stats.generated}")
    print(f"  Skipped   : {stats.skipped} (already existed)")
    print(f"  Failed    : {stats.failed}")
    print(f"  Total files expected: {total * len(AUDIO_TASKS)}")


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Batch-generate audio files for LearnE vocabulary app using edge-tts.",
    )
    parser.add_argument(
        "--input",
        type=str,
        default="/root/projects/LearnE/data/words_cet4.json",
        help="Path to the words JSON file (default: /root/projects/LearnE/data/words_cet4.json)",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="/root/projects/LearnE/audio",
        help="Base output directory for audio files (default: /root/projects/LearnE/audio)",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=5,
        help="Number of concurrent TTS tasks (default: 5)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Only process the first N words (useful for testing)",
    )
    parser.add_argument(
        "--word",
        type=str,
        default=None,
        help="Generate audio for a single specific word (for testing)",
    )
    return parser.parse_args()


def main() -> None:
    """Entry point."""
    args = parse_args()

    if args.concurrency < 1:
        print("ERROR: --concurrency must be at least 1.", file=sys.stderr)
        sys.exit(1)

    try:
        asyncio.run(main_async(args))
    except KeyboardInterrupt:
        print("\nInterrupted by user. Partial progress has been saved.")
        sys.exit(130)
    except Exception:
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
