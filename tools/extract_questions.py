#!/usr/bin/env python3
"""Extract the question bank from professional_exam.pdf into site/data/questions.json.

PDF layout (遙控無人機專業操作證學科測驗題庫):
  - Question pages: chapter headings 「第X章 <title>」, then numbered questions
    「N. <stem>」 each followed by four options 「(A)..(D)」. Numbering restarts
    per chapter.
  - Answer pages at the end: headings 「第X章 <title>答案」 followed by
    「N. <letter>」 pairs.
"""
import json
import re
import sys
from pathlib import Path

import fitz  # PyMuPDF

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "professional_exam.pdf"
OUT = ROOT / "site" / "data" / "questions.json"

CHAPTER_RE = re.compile(r"^第[一二三四五六七八九十]+章\s*(.+?)\s*$")
QNUM_RE = re.compile(r"^(\d+)\.\s*(.*)$")
OPT_RE = re.compile(r"^\((A|B|C|D)\)\s*(.*)$")


def page_lines(page):
    lines = [ln.strip() for ln in page.get_text().splitlines()]
    # Drop the leading page-number line (a bare integer) and blanks.
    out = []
    for i, ln in enumerate(lines):
        if not ln:
            continue
        if not out and ln.isdigit():
            continue
        out.append(ln)
    return out


def parse(doc):
    chapters = []  # [{title, questions: [...]}]
    answers = {}   # title -> {num: letter}
    cur_chapter = None
    cur_answer_key = None
    cur_q = None
    cur_opt = None

    def close_question():
        nonlocal cur_q, cur_opt
        if cur_q is not None:
            cur_chapter["questions"].append(cur_q)
        cur_q = None
        cur_opt = None

    for page in doc:
        for ln in page_lines(page):
            m = CHAPTER_RE.match(ln)
            if m:
                title = m.group(1)
                if title.endswith("答案"):
                    close_question()
                    cur_chapter = None
                    cur_answer_key = answers.setdefault(title[:-2].strip(), {})
                else:
                    close_question()
                    cur_chapter = {"title": title, "questions": []}
                    chapters.append(cur_chapter)
                    cur_answer_key = None
                continue

            if cur_answer_key is not None:
                # Answer lines: 「N. X」 or 「N.」 with the letter on the next line.
                for num, letter in re.findall(r"(\d+)\.\s*([A-D])?", ln):
                    if letter:
                        cur_answer_key[int(num)] = letter
                    else:
                        cur_answer_key[int(num)] = None  # letter arrives next line
                if re.fullmatch(r"[A-D]", ln):
                    pending = [k for k, v in cur_answer_key.items() if v is None]
                    if pending:
                        cur_answer_key[pending[-1]] = ln
                continue

            if cur_chapter is None:
                continue  # preamble (title page text)

            m = QNUM_RE.match(ln)
            if m and (cur_q is None or cur_opt == "D" or not m.group(2) == ""):
                # A new question starts only when we're not mid-question, or the
                # previous question already collected all four options.
                if cur_q is None or cur_opt == "D":
                    close_question()
                    cur_q = {
                        "number": int(m.group(1)),
                        "stem": m.group(2).strip(),
                        "options": {},
                    }
                    cur_opt = None
                    continue

            m = OPT_RE.match(ln)
            if m and cur_q is not None:
                cur_opt = m.group(1)
                cur_q["options"][cur_opt] = m.group(2).strip()
                continue

            # Continuation line: append to current option or stem.
            if cur_q is not None:
                if cur_opt:
                    cur_q["options"][cur_opt] += ln
                else:
                    cur_q["stem"] += ln

    close_question()
    return chapters, answers


def main():
    doc = fitz.open(PDF)
    chapters, answers = parse(doc)

    errors = []
    for ch in chapters:
        key = answers.get(ch["title"])
        if key is None:
            errors.append(f"no answer key for chapter {ch['title']!r}")
            continue
        nums = [q["number"] for q in ch["questions"]]
        if nums != list(range(1, len(nums) + 1)):
            gaps = [n for a, b in zip(nums, nums[1:]) for n in range(a + 1, b)]
            errors.append(f"{ch['title']}: non-sequential numbering, gaps {gaps}")
        if set(key) != set(nums):
            errors.append(
                f"{ch['title']}: {len(nums)} questions vs {len(key)} answers; "
                f"missing answers for {sorted(set(nums) - set(key))[:10]}"
            )
        for q in ch["questions"]:
            if sorted(q["options"]) != ["A", "B", "C", "D"]:
                errors.append(
                    f"{ch['title']} Q{q['number']}: options {sorted(q['options'])}"
                )
            ans = key.get(q["number"])
            if ans not in ("A", "B", "C", "D"):
                errors.append(f"{ch['title']} Q{q['number']}: bad answer {ans!r}")
            q["answer"] = ans

    for ch in chapters:
        print(f"{ch['title']}: {len(ch['questions'])} questions")
    total = sum(len(ch["questions"]) for ch in chapters)
    print(f"total: {total}")

    if errors:
        print("\nVALIDATION ERRORS:")
        for e in errors:
            print(" -", e)
        sys.exit(1)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "source": PDF.name,
        "title": "遙控無人機專業操作證學科測驗題庫",
        "chapters": chapters,
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
