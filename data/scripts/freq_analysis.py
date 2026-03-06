#!/usr/bin/env python3
"""
CET-4 Exam Text Frequency Analysis

Reads raw CET-4 exam texts, tokenizes and lemmatizes them with spaCy,
filters against the official CET-4 syllabus word list, and outputs a
frequency-ranked JSON file.

Usage:
    python freq_analysis.py
    python freq_analysis.py --texts-dir /path/to/texts --syllabus /path/to/syllabus.txt --output /path/to/output.json
"""

import argparse
import json
import logging
import sys
from collections import Counter
from pathlib import Path

# ---------------------------------------------------------------------------
# Constants / defaults
# ---------------------------------------------------------------------------
DEFAULT_TEXTS_DIR = Path(__file__).resolve().parent.parent / "raw_texts" / "cet4"
DEFAULT_SYLLABUS = Path(__file__).resolve().parent.parent / "wordlists" / "cet4_syllabus.txt"
DEFAULT_OUTPUT = Path(__file__).resolve().parent.parent / "wordlists" / "cet4_freq_ranked.json"

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Core helpers
# ---------------------------------------------------------------------------

def load_text_files(texts_dir: Path) -> str:
    """Read and concatenate all .txt files under *texts_dir*.

    Returns the combined text as a single string.
    Raises FileNotFoundError if the directory does not exist or contains no
    .txt files.
    """
    if not texts_dir.is_dir():
        raise FileNotFoundError(f"Texts directory not found: {texts_dir}")

    txt_files = sorted(texts_dir.glob("*.txt"))
    if not txt_files:
        raise FileNotFoundError(f"No .txt files found in {texts_dir}")

    logger.info("Found %d .txt file(s) in %s", len(txt_files), texts_dir)

    chunks: list[str] = []
    for fp in txt_files:
        logger.info("  Reading %s", fp.name)
        chunks.append(fp.read_text(encoding="utf-8"))

    combined = "\n".join(chunks)
    logger.info("Total characters read: %d", len(combined))
    return combined


def load_syllabus(syllabus_path: Path) -> set[str]:
    """Load the CET-4 syllabus word list (one word per line).

    Returns a set of lowercased words.
    Raises FileNotFoundError if the file does not exist.
    """
    if not syllabus_path.is_file():
        raise FileNotFoundError(f"Syllabus file not found: {syllabus_path}")

    words: set[str] = set()
    with syllabus_path.open(encoding="utf-8") as fh:
        for line in fh:
            word = line.strip().lower()
            if word:
                words.add(word)

    logger.info("Loaded %d syllabus words from %s", len(words), syllabus_path)
    return words


def tokenize_and_count(text: str) -> Counter:
    """Tokenize, lemmatize, and count word frequencies using spaCy.

    Filters out:
      - stop words
      - punctuation tokens
      - numeric tokens
      - tokens whose lemma is shorter than 2 characters

    Returns a Counter mapping lemma -> frequency.
    """
    try:
        import spacy  # noqa: E402
    except ImportError:
        logger.error(
            "spaCy is not installed. Install it with: pip install spacy"
        )
        raise

    logger.info("Loading spaCy model 'en_core_web_sm' ...")
    try:
        nlp = spacy.load("en_core_web_sm")
    except OSError:
        logger.error(
            "spaCy model 'en_core_web_sm' not found. "
            "Download it with: python -m spacy download en_core_web_sm"
        )
        raise

    # Increase max_length if the combined text is very large.
    nlp.max_length = max(nlp.max_length, len(text) + 1000)

    logger.info("Tokenizing and lemmatizing (%d characters) ...", len(text))

    counter: Counter = Counter()
    # Process in chunks via nlp.pipe for memory efficiency on large corpora.
    # sentencizer is faster than the full parser for our purposes.
    chunk_size = 100_000
    chunks = [text[i : i + chunk_size] for i in range(0, len(text), chunk_size)]
    total_chunks = len(chunks)

    for idx, doc in enumerate(nlp.pipe(chunks, batch_size=4), start=1):
        if idx % 5 == 0 or idx == total_chunks:
            logger.info("  Processed chunk %d / %d", idx, total_chunks)

        for token in doc:
            if token.is_stop:
                continue
            if token.is_punct:
                continue
            if token.like_num:
                continue
            lemma = token.lemma_.lower().strip()
            if len(lemma) < 2:
                continue
            # Skip tokens that are not purely alphabetic (removes stray
            # symbols, hyphenated fragments, etc.)
            if not lemma.isalpha():
                continue
            counter[lemma] += 1

    logger.info("Unique lemmas after filtering: %d", len(counter))
    return counter


def intersect_with_syllabus(
    counter: Counter, syllabus: set[str]
) -> list[dict]:
    """Keep only words present in the syllabus and return ranked results.

    Returns a list of dicts sorted by descending frequency, each with keys
    ``word``, ``freq``, and ``rank``.
    """
    filtered = {word: freq for word, freq in counter.items() if word in syllabus}
    logger.info(
        "Words matching syllabus: %d / %d syllabus entries",
        len(filtered),
        len(syllabus),
    )

    # Sort by frequency descending, then alphabetically for ties.
    sorted_items = sorted(filtered.items(), key=lambda x: (-x[1], x[0]))

    results: list[dict] = []
    for rank, (word, freq) in enumerate(sorted_items, start=1):
        results.append({"word": word, "freq": freq, "rank": rank})

    return results


def write_output(results: list[dict], output_path: Path) -> None:
    """Write the ranked word list to a JSON file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as fh:
        json.dump(results, fh, ensure_ascii=False, indent=2)
    logger.info("Wrote %d entries to %s", len(results), output_path)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="CET-4 exam text frequency analysis with spaCy.",
    )
    parser.add_argument(
        "--texts-dir",
        type=Path,
        default=DEFAULT_TEXTS_DIR,
        help="Directory containing .txt exam texts (default: %(default)s)",
    )
    parser.add_argument(
        "--syllabus",
        type=Path,
        default=DEFAULT_SYLLABUS,
        help="Path to CET-4 syllabus word list (default: %(default)s)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Output JSON file path (default: %(default)s)",
    )
    return parser.parse_args(argv)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)

    logger.info("=== CET-4 Frequency Analysis ===")
    logger.info("Texts dir : %s", args.texts_dir)
    logger.info("Syllabus  : %s", args.syllabus)
    logger.info("Output    : %s", args.output)

    try:
        text = load_text_files(args.texts_dir)
    except FileNotFoundError as exc:
        logger.error(str(exc))
        sys.exit(1)

    try:
        syllabus = load_syllabus(args.syllabus)
    except FileNotFoundError as exc:
        logger.error(str(exc))
        sys.exit(1)

    try:
        counter = tokenize_and_count(text)
    except (ImportError, OSError) as exc:
        logger.error("spaCy error: %s", exc)
        sys.exit(1)

    results = intersect_with_syllabus(counter, syllabus)

    write_output(results, args.output)

    if results:
        logger.info("Top 10 words:")
        for entry in results[:10]:
            logger.info(
                "  #%d  %-20s  freq=%d", entry["rank"], entry["word"], entry["freq"]
            )

    logger.info("=== Done ===")


if __name__ == "__main__":
    main()
