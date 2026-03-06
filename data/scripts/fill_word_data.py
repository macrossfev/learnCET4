#!/usr/bin/env python3
"""
Batch fill word entry data (phrase, example) using LLM API.

Supports OpenAI-compatible APIs (OpenAI, DeepSeek, etc.) and Anthropic Claude.

Usage:
    # Using OpenAI-compatible API (e.g., DeepSeek)
    export OPENAI_API_KEY="sk-xxx"
    export OPENAI_BASE_URL="https://api.deepseek.com"   # optional
    export OPENAI_MODEL="deepseek-chat"                  # optional
    python fill_word_data.py --provider openai

    # Using Anthropic Claude
    export ANTHROPIC_API_KEY="sk-ant-xxx"
    python fill_word_data.py --provider anthropic

    # Options
    python fill_word_data.py --provider openai --batch-size 30 --limit 100
"""

import argparse
import json
import logging
import os
import sys
import time
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

DEFAULT_INPUT = Path(__file__).resolve().parent.parent / "words_cet4.json"

PROMPT_TEMPLATE = """You are a CET-4 English vocabulary expert. For each word below, provide:
1. One common phrase/collocation (2-4 words, commonly seen in CET-4 exams)
2. Chinese translation of that phrase
3. One short example sentence (under 10 words, simple and natural)
4. Chinese translation of that sentence

The Chinese meaning is provided for context - use the GIVEN meaning to choose the right phrase and example.

Return ONLY a JSON array, no other text. Format:
[
  {{"word":"example","phrase":"for example","phrase_meaning":"例如","example":"For example, she likes reading.","example_meaning":"例如，她喜欢阅读。"}}
]

Words to process:
{words_json}"""


def load_words(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def save_words(path: Path, words: list[dict]):
    with path.open("w", encoding="utf-8") as f:
        json.dump(words, f, ensure_ascii=False, indent=2)


def get_unfilled(words: list[dict]) -> list[int]:
    """Return indices of entries missing phrase or example."""
    indices = []
    for i, w in enumerate(words):
        if not w.get("phrase") or not w.get("example"):
            indices.append(i)
    return indices


def build_batch_prompt(words: list[dict], indices: list[int]) -> str:
    batch = [{"word": words[i]["word"], "meaning": words[i].get("meaning", "")}
             for i in indices]
    return PROMPT_TEMPLATE.format(words_json=json.dumps(batch, ensure_ascii=False))


def parse_response(text: str) -> list[dict]:
    """Extract JSON array from LLM response text."""
    text = text.strip()
    # Find JSON array boundaries
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1:
        raise ValueError("No JSON array found in response")
    json_str = text[start:end + 1]
    return json.loads(json_str)


def call_openai(prompt: str, api_key: str, base_url: str, model: str) -> str:
    try:
        from openai import OpenAI
    except ImportError:
        logger.error("openai package not installed. Run: pip install openai")
        sys.exit(1)

    client = OpenAI(api_key=api_key, base_url=base_url)
    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=4096,
    )
    return resp.choices[0].message.content


def call_anthropic(prompt: str, api_key: str, model: str) -> str:
    try:
        import anthropic
    except ImportError:
        logger.error("anthropic package not installed. Run: pip install anthropic")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)
    resp = client.messages.create(
        model=model,
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )
    return resp.content[0].text


def process_batch(words: list[dict], indices: list[int], call_fn) -> int:
    """Process a batch of words. Returns number of successfully filled entries."""
    prompt = build_batch_prompt(words, indices)
    batch_words = [words[i]["word"] for i in indices]

    try:
        response_text = call_fn(prompt)
        results = parse_response(response_text)
    except Exception as e:
        logger.error("API call or parse failed: %s", e)
        return 0

    # Build lookup from results
    result_map = {r["word"]: r for r in results if "word" in r}

    filled = 0
    for idx in indices:
        w = words[idx]["word"]
        if w in result_map:
            r = result_map[w]
            words[idx]["phrase"] = r.get("phrase", "")
            words[idx]["phrase_meaning"] = r.get("phrase_meaning", "")
            words[idx]["example"] = r.get("example", "")
            words[idx]["example_meaning"] = r.get("example_meaning", "")
            if words[idx]["phrase"] and words[idx]["example"]:
                filled += 1

    return filled


def main():
    parser = argparse.ArgumentParser(description="Batch fill word data using LLM API")
    parser.add_argument("--provider", required=True, choices=["openai", "anthropic"],
                        help="LLM API provider")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT,
                        help="Path to words JSON file")
    parser.add_argument("--batch-size", type=int, default=25,
                        help="Words per API call (default: 25)")
    parser.add_argument("--limit", type=int, default=0,
                        help="Only process first N unfilled words (0=all)")
    parser.add_argument("--delay", type=float, default=1.0,
                        help="Seconds to wait between API calls (default: 1.0)")
    parser.add_argument("--model", type=str, default=None,
                        help="Override model name")
    args = parser.parse_args()

    # Load words
    words = load_words(args.input)
    unfilled = get_unfilled(words)
    logger.info("Total words: %d | Unfilled: %d", len(words), len(unfilled))

    if not unfilled:
        logger.info("All entries already filled. Nothing to do.")
        return

    if args.limit > 0:
        unfilled = unfilled[:args.limit]
        logger.info("Limited to first %d unfilled words", len(unfilled))

    # Setup API caller
    if args.provider == "openai":
        api_key = os.environ.get("OPENAI_API_KEY", "")
        base_url = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
        model = args.model or os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
        if not api_key:
            logger.error("Set OPENAI_API_KEY environment variable")
            sys.exit(1)
        call_fn = lambda prompt: call_openai(prompt, api_key, base_url, model)
        logger.info("Provider: OpenAI-compatible | Base: %s | Model: %s", base_url, model)

    elif args.provider == "anthropic":
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        model = args.model or "claude-sonnet-4-20250514"
        if not api_key:
            logger.error("Set ANTHROPIC_API_KEY environment variable")
            sys.exit(1)
        call_fn = lambda prompt: call_anthropic(prompt, api_key, model)
        logger.info("Provider: Anthropic | Model: %s", model)

    # Process in batches
    total_filled = 0
    total_batches = (len(unfilled) + args.batch_size - 1) // args.batch_size

    for batch_num in range(total_batches):
        start = batch_num * args.batch_size
        end = min(start + args.batch_size, len(unfilled))
        batch_indices = unfilled[start:end]
        batch_words = [words[i]["word"] for i in batch_indices]

        logger.info("[Batch %d/%d] Processing %d words: %s ...",
                     batch_num + 1, total_batches, len(batch_indices),
                     ", ".join(batch_words[:5]))

        filled = process_batch(words, batch_indices, call_fn)
        total_filled += filled
        logger.info("[Batch %d/%d] Filled: %d/%d", batch_num + 1, total_batches,
                     filled, len(batch_indices))

        # Save after each batch (resumable)
        save_words(args.input, words)

        if batch_num < total_batches - 1:
            time.sleep(args.delay)

    # Final stats
    remaining = len(get_unfilled(words))
    logger.info("=" * 50)
    logger.info("DONE. Filled: %d | Remaining unfilled: %d", total_filled, remaining)
    logger.info("Data saved to: %s", args.input)


if __name__ == "__main__":
    main()
