#!/usr/bin/env python3
"""
워들에 쓸 영어 단어 목록 두 개를 만든다.

왜 두 개냐:
  - 정답 목록  : 친구들이 아는 흔한 단어만. 여기서 오늘의 단어를 뽑는다
  - 허용 목록  : 사전에 있으면 다 받아준다. 없으면 "그런 단어 없음" 처리
  하나로 합치면 SOUGH 같은 게 정답으로 나오거나, 반대로 아는 단어인데
  입력이 거부되는 일이 생긴다.

왜 실행 중에 API 를 안 쓰냐:
  - 매 추측마다 왕복이 생겨 느리고, 인터넷이 끊기면 게임이 멈춘다
  - 더 중요한 건, 서버가 없어서 "랜덤"을 쓰면 사람마다 정답이 달라진다.
    정답은 파티 ID + 날짜로 결정론적으로 뽑는다 (src/lib/game/daily.ts)

실행:
    pip install wordfreq
    npm i an-array-of-english-words
    python3 scripts/build-words.py

결과 파일은 커밋한다. 이 스크립트는 목록을 다시 만들 때만 돌리면 된다.
"""

import json
import pathlib
import subprocess
import sys

from wordfreq import zipf_frequency

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "lib" / "game" / "words.json"

# zipf 는 로그 척도. 3.0 이면 100만 단어당 1번쯤 나오는 빈도로,
# 사람들이 "아는" 단어의 경계쯤이다. 이 값을 올리면 정답이 더 쉬워진다.
ANSWER_MIN_ZIPF = 3.25
ANSWER_MAX = 2500

# 정답으로 나오면 곤란한 단어들. 입력은 계속 허용한다 — 막을 이유가 없고,
# 막으면 오히려 "왜 이건 안 되지" 하고 신경이 그쪽으로 간다.
# 진짜 워들도 같은 방식으로 정답에서만 뺀다.
BLOCKED = {
    "bitch", "penis", "pussy", "semen", "sperm", "screw", "whore",
    "dildo", "boobs", "crack", "junkie", "nazis", "rapes", "raped",
    "queer", "spick", "wench", "cocks", "dicks", "fucks", "shits",
    "damns", "hells", "chink", "kikes", "dyked", "faggy",
}


def five_letter_words() -> list[str]:
    """npm 사전에서 5글자 단어만 뽑는다."""
    js = (
        "const w=require('an-array-of-english-words');"
        "process.stdout.write(w.filter(x=>/^[a-z]{5}$/.test(x)).join('\\n'))"
    )
    out = subprocess.run(
        ["node", "-e", js], capture_output=True, text=True, check=True
    ).stdout
    return out.split("\n")


def looks_like_plural(word: str, vocab: set[str]) -> bool:
    """SOULS 처럼 4글자 단어 + s 인 것. 진짜 워들도 이런 건 정답에서 뺀다."""
    return word.endswith("s") and word[:-1] in vocab


def main() -> None:
    allowed = sorted(set(five_letter_words()))
    if len(allowed) < 5000:
        sys.exit(f"5글자 단어가 너무 적다: {len(allowed)}")

    four = {w[:-1] for w in allowed}
    # 4글자 단어도 있어야 복수형 판별이 되므로 사전 전체에서 다시 본다
    all_words = set(
        subprocess.run(
            [
                "node",
                "-e",
                "const w=require('an-array-of-english-words');"
                "process.stdout.write(w.join('\\n'))",
            ],
            capture_output=True,
            text=True,
            check=True,
        ).stdout.split("\n")
    )
    del four

    scored = [(w, zipf_frequency(w, "en")) for w in allowed]
    answers = [
        w
        for w, z in sorted(scored, key=lambda t: -t[1])
        if z >= ANSWER_MIN_ZIPF
        and w not in BLOCKED
        and not looks_like_plural(w, all_words)
    ][:ANSWER_MAX]

    # 뽑는 순서가 빈도순이면 목록 앞쪽만 계속 나오는 게 아니라
    # 시드 해시로 고르므로 순서는 상관없다. 다만 diff 를 읽기 쉽게 정렬해 둔다.
    answers.sort()

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {"answers": " ".join(answers), "allowed": " ".join(allowed)},
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    size = OUT.stat().st_size / 1024
    print(f"정답 {len(answers)}개 · 허용 {len(allowed)}개 → {OUT.name} {size:.0f}KB")


if __name__ == "__main__":
    main()
