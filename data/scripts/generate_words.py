#!/usr/bin/env python3
"""
generate_words.py - Generate complete word entry data for the LearnE app.

Reads the frequency-ranked word list produced by freq_analysis.py and generates
full word entries for the CET-4 vocabulary dataset.

Modes:
    template - Generate a template JSON with empty fields (meaning, phonetic,
               phrase, phrase_meaning, example, example_meaning) that need
               manual filling. Pre-fills word, freq_rank, and level.
    merge    - Read an existing partially-filled words file and merge/validate
               it, reporting which entries are still incomplete.

Usage:
    python generate_words.py --mode template [--limit N]
    python generate_words.py --mode merge [--limit N]
"""

import argparse
import json
import logging
import os
import sys
from pathlib import Path

# ----- Configuration -----

BASE_DIR = Path(__file__).resolve().parent.parent  # /root/projects/LearnE/data
INPUT_PATH = BASE_DIR / "wordlists" / "cet4_freq_ranked.json"
OUTPUT_PATH = BASE_DIR / "words_cet4.json"

REQUIRED_FIELDS = [
    "word",
    "phonetic",
    "meaning",
    "phrase",
    "phrase_meaning",
    "example",
    "example_meaning",
    "freq_rank",
    "level",
]

LEVEL = "CET4"

# ----- Logging setup -----

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ----- Helper functions -----


def read_json(filepath: Path) -> list | dict:
    """Read a JSON file with UTF-8 encoding."""
    logger.info("Reading file: %s", filepath)
    if not filepath.exists():
        logger.error("File not found: %s", filepath)
        sys.exit(1)
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        logger.info("Successfully read %s", filepath)
        return data
    except json.JSONDecodeError as e:
        logger.error("Invalid JSON in %s: %s", filepath, e)
        sys.exit(1)
    except OSError as e:
        logger.error("Failed to read %s: %s", filepath, e)
        sys.exit(1)


def write_json(filepath: Path, data: list | dict) -> None:
    """Write data to a JSON file with UTF-8 encoding and readable formatting."""
    logger.info("Writing file: %s", filepath)
    try:
        filepath.parent.mkdir(parents=True, exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        logger.info("Successfully wrote %d entries to %s", len(data), filepath)
    except OSError as e:
        logger.error("Failed to write %s: %s", filepath, e)
        sys.exit(1)


def create_template_entry(word: str, freq_rank: int) -> dict:
    """Create a template word entry with empty fields for manual filling."""
    return {
        "word": word,
        "phonetic": "",
        "meaning": "",
        "phrase": "",
        "phrase_meaning": "",
        "example": "",
        "example_meaning": "",
        "freq_rank": freq_rank,
        "level": LEVEL,
    }


def validate_entry(entry: dict, index: int) -> list[str]:
    """
    Validate that all required fields are present and non-empty in a word entry.

    Returns a list of field names that are missing or empty.
    """
    missing = []
    for field in REQUIRED_FIELDS:
        if field not in entry:
            missing.append(field)
        elif isinstance(entry[field], str) and entry[field].strip() == "":
            missing.append(field)
    return missing


def parse_ranked_list(ranked_data: list | dict) -> list[dict]:
    """
    Parse the frequency-ranked word list into a normalized list of
    {word, freq_rank} dicts.

    Supports multiple input formats:
      - A list of strings: ["abandon", "ability", ...]
        freq_rank is assigned by position (1-based).
      - A list of dicts with at least a "word" key:
        [{"word": "abandon", "freq_rank": 1, ...}, ...]
        If "freq_rank" is missing, it is assigned by position.
      - A dict mapping words to frequency info:
        {"abandon": {"count": 120, ...}, ...}
        Words are sorted by their position/count and assigned ranks.
    """
    entries = []

    if isinstance(ranked_data, list):
        for i, item in enumerate(ranked_data):
            rank = i + 1
            if isinstance(item, str):
                entries.append({"word": item, "freq_rank": rank})
            elif isinstance(item, dict):
                word = item.get("word", "")
                if not word:
                    logger.warning(
                        "Skipping list entry at index %d: no 'word' field found", i
                    )
                    continue
                freq_rank = item.get("freq_rank", rank)
                entries.append({"word": word, "freq_rank": freq_rank})
            else:
                logger.warning(
                    "Skipping list entry at index %d: unexpected type %s",
                    i,
                    type(item).__name__,
                )
    elif isinstance(ranked_data, dict):
        # Dict format: keys are words, values may contain rank/count info
        for i, (word, info) in enumerate(ranked_data.items()):
            rank = i + 1
            if isinstance(info, dict):
                freq_rank = info.get("freq_rank", info.get("rank", rank))
            else:
                freq_rank = rank
            entries.append({"word": word, "freq_rank": freq_rank})
    else:
        logger.error(
            "Unexpected data format in ranked list: %s", type(ranked_data).__name__
        )
        sys.exit(1)

    if not entries:
        logger.error("No valid word entries found in the ranked list.")
        sys.exit(1)

    # Sort by freq_rank to ensure consistent ordering
    entries.sort(key=lambda x: x["freq_rank"])
    logger.info("Parsed %d words from the ranked list.", len(entries))
    return entries


# ----- Mode: template -----


def mode_template(ranked_entries: list[dict]) -> list[dict]:
    """
    Generate template word entries with empty content fields,
    pre-filled with word and freq_rank from the ranked list.
    """
    logger.info("Generating template entries for %d words...", len(ranked_entries))
    result = []
    for entry in ranked_entries:
        template = create_template_entry(entry["word"], entry["freq_rank"])
        result.append(template)
    logger.info("Template generation complete: %d entries created.", len(result))
    return result


# ----- Mode: merge -----


def mode_merge(ranked_entries: list[dict]) -> list[dict]:
    """
    Read an existing partially-filled words file, merge it with the ranked
    list, and validate completeness. Reports which entries are still incomplete.
    """
    if not OUTPUT_PATH.exists():
        logger.error(
            "Merge mode requires an existing words file at %s. "
            "Run with --mode template first to create it.",
            OUTPUT_PATH,
        )
        sys.exit(1)

    existing_data = read_json(OUTPUT_PATH)
    if not isinstance(existing_data, list):
        logger.error("Existing words file must contain a JSON array.")
        sys.exit(1)

    # Build a lookup from the existing data keyed by word
    existing_lookup: dict[str, dict] = {}
    for entry in existing_data:
        word = entry.get("word", "")
        if word:
            existing_lookup[word] = entry

    logger.info(
        "Loaded %d existing entries from %s", len(existing_lookup), OUTPUT_PATH
    )

    # Build the ranked word set for quick membership checks
    ranked_words = {e["word"] for e in ranked_entries}

    result = []
    complete_count = 0
    incomplete_count = 0
    new_count = 0
    incomplete_details: list[tuple[str, list[str]]] = []

    for entry in ranked_entries:
        word = entry["word"]
        freq_rank = entry["freq_rank"]

        if word in existing_lookup:
            # Merge: use existing data but ensure freq_rank and level are current
            merged = dict(existing_lookup[word])
            merged["freq_rank"] = freq_rank
            merged["level"] = LEVEL

            # Ensure all required fields exist (add empty ones if missing)
            for field in REQUIRED_FIELDS:
                if field not in merged:
                    merged[field] = ""
        else:
            # New word not in existing file: create a template entry
            merged = create_template_entry(word, freq_rank)
            new_count += 1

        # Validate
        missing = validate_entry(merged, freq_rank)
        if missing:
            incomplete_count += 1
            incomplete_details.append((word, missing))
        else:
            complete_count += 1

        result.append(merged)

    # Check for words in existing file that are not in the ranked list
    orphaned = [w for w in existing_lookup if w not in ranked_words]
    if orphaned:
        logger.warning(
            "%d words in existing file are NOT in the ranked list and will be "
            "excluded: %s%s",
            len(orphaned),
            ", ".join(orphaned[:10]),
            "..." if len(orphaned) > 10 else "",
        )

    # Report summary
    logger.info("=" * 60)
    logger.info("MERGE REPORT")
    logger.info("=" * 60)
    logger.info("Total words processed:   %d", len(result))
    logger.info("Complete entries:        %d", complete_count)
    logger.info("Incomplete entries:      %d", incomplete_count)
    logger.info("New entries (template):  %d", new_count)
    if orphaned:
        logger.info("Orphaned (excluded):     %d", len(orphaned))
    logger.info("=" * 60)

    # Report details of incomplete entries
    if incomplete_details:
        logger.info("")
        logger.info("INCOMPLETE ENTRIES:")
        logger.info("-" * 60)
        for word, missing_fields in incomplete_details:
            logger.info("  %-25s  missing: %s", word, ", ".join(missing_fields))
        logger.info("-" * 60)
        logger.info(
            "Fill in the missing fields in %s and run merge again.", OUTPUT_PATH
        )

    return result


# ----- Main -----


def main():
    parser = argparse.ArgumentParser(
        description="Generate complete word entry data for the LearnE app.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python generate_words.py --mode template\n"
            "  python generate_words.py --mode template --limit 100\n"
            "  python generate_words.py --mode merge\n"
            "  python generate_words.py --mode merge --limit 500\n"
        ),
    )
    parser.add_argument(
        "--mode",
        required=True,
        choices=["template", "merge"],
        help=(
            "'template' generates a JSON with empty fields for manual filling. "
            "'merge' reads an existing partially-filled file and validates it."
        ),
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        metavar="N",
        help="Only process the top N words by frequency rank (default: all).",
    )

    args = parser.parse_args()

    logger.info("LearnE word data generator")
    logger.info("Mode: %s", args.mode)
    logger.info("Input: %s", INPUT_PATH)
    logger.info("Output: %s", OUTPUT_PATH)

    # Read the frequency-ranked word list
    ranked_data = read_json(INPUT_PATH)
    ranked_entries = parse_ranked_list(ranked_data)

    # Apply limit
    if args.limit > 0:
        ranked_entries = ranked_entries[: args.limit]
        logger.info("Limited to top %d words.", args.limit)

    # Execute the selected mode
    if args.mode == "template":
        result = mode_template(ranked_entries)
    elif args.mode == "merge":
        result = mode_merge(ranked_entries)
    else:
        # Should not be reachable due to argparse choices
        logger.error("Unknown mode: %s", args.mode)
        sys.exit(1)

    # Write the output
    write_json(OUTPUT_PATH, result)

    logger.info("Done.")


if __name__ == "__main__":
    main()
