import { useEffect, useMemo, useState } from "react";
import type { GameRow } from "../lib/presence";
import type { Member } from "../types";
import {
  BASEBALL,
  WORDLE,
  evaluateBaseball,
  evaluateWordle,
  isSolved,
  isWellFormed,
  keyboardMarks,
  maxAttempts,
  wordLength,
  type GameKind,
  type Mark,
} from "../lib/game/rules";
import { dailySecret, isRealWord, todayKey } from "../lib/game/daily";
import { Face } from "./Face";

interface Props {
  kind: GameKind;
  partyId: string;
  meId: string;
  members: Member[];
  rows: GameRow[];
  onProgress: (p: {
    attempts: number;
    solved: boolean;
    marks: string[];
  }) => void;
}

interface Attempt {
  guess: string;
  marks: Mark[];
  score: { strike: number; ball: number } | null;
}

const KEYS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const DIGITS = ["12345", "67890"];

/** 내 시도를 기기에 남긴다. 정답은 저장 안 한다 (매번 시드에서 다시 뽑는다) */
function storageKey(partyId: string, kind: GameKind, day: string) {
  return `runstudy.game.${partyId}.${kind}.${day}`;
}

export function GameBoard({
  kind,
  partyId,
  meId,
  members,
  rows,
  onProgress,
}: Props) {
  const day = todayKey();
  const secret = useMemo(
    () => dailySecret(partyId, kind, day),
    [partyId, kind, day],
  );
  const len = wordLength(kind);
  const max = maxAttempts(kind);

  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [input, setInput] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  // 방·게임·날짜가 바뀌면 판을 갈아끼운다
  useEffect(() => {
    let saved: Attempt[] = [];
    try {
      const raw = localStorage.getItem(storageKey(partyId, kind, day));
      if (raw) saved = JSON.parse(raw) as Attempt[];
    } catch {
      /* 무시 */
    }
    setAttempts(saved);
    setInput("");
  }, [partyId, kind, day]);

  const solved = attempts.some((a) => isSolved(secret, a.guess));
  const done = solved || attempts.length >= max;

  function say(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1400);
  }

  function submit() {
    if (done) return;
    const guess = input.toLowerCase();

    if (guess.length < len) return say(`${len}글자를 채워주세요`);
    if (!isWellFormed(kind, guess)) {
      return say(
        kind === "wordle" ? "영문자만 넣어주세요" : "서로 다른 숫자 4개",
      );
    }
    if (kind === "wordle" && !isRealWord(guess)) {
      return say("사전에 없는 단어예요");
    }

    const attempt: Attempt =
      kind === "wordle"
        ? { guess, marks: evaluateWordle(secret, guess), score: null }
        : { guess, marks: [], score: evaluateBaseball(secret, guess) };

    const next = [...attempts, attempt];
    setAttempts(next);
    setInput("");

    try {
      localStorage.setItem(storageKey(partyId, kind, day), JSON.stringify(next));
    } catch {
      /* 무시 */
    }

    // 친구들에게는 채점 결과만 넘긴다. 추측한 단어를 넘기면 답이 샌다.
    onProgress({
      attempts: next.length,
      solved: isSolved(secret, guess),
      marks: next.map((a) =>
        a.score
          ? `${a.score.strike}S${a.score.ball}B`
          : a.marks.map((m) => m[0]).join(""),
      ),
    });
  }

  function type(ch: string) {
    if (done || input.length >= len) return;
    setInput(input + ch);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter") return submit();
      if (e.key === "Backspace") return setInput((s) => s.slice(0, -1));
      const ch = e.key.toLowerCase();
      const ok = kind === "wordle" ? /^[a-z]$/.test(ch) : /^[0-9]$/.test(ch);
      if (ok) type(ch);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const kb = useMemo(
    () =>
      kind === "wordle"
        ? keyboardMarks(attempts.map((a) => ({ guess: a.guess, marks: a.marks })))
        : {},
    [attempts, kind],
  );

  /* 미리 빈 칸을 다 깔지 않는다. 제출한 줄들 + (아직이면) 지금 치는 줄
   * 한 개만 그린다. 남은 횟수는 숫자로 따로 보여주므로, 빈 칸이 줄 수를
   * 알려줄 필요가 없다. */
  const left = max - attempts.length;

  /* 오늘의 순위.
   *
   * 다 같이 같은 문제를 푸니까 "몇 번 만에 풀었나"로 줄을 세울 수 있다.
   * 정렬 규칙: 푼 사람 먼저(적은 횟수 → 먼저 푼 순), 그다음 푸는 중,
   * 기회를 다 쓴 사람, 아직 시작 안 한 사람 순.
   * 나도 목록에 포함한다 — 내 등수를 못 보면 순위표가 아니다. */
  const ranked = useMemo(() => {
    const byUser = new Map(rows.map((r) => [r.userId, r]));
    const entries = members.map((member) => ({
      member,
      row: byUser.get(member.id),
    }));

    const bucket = (e: (typeof entries)[number]) => {
      if (!e.row) return 3;
      if (e.row.solved) return 0;
      return e.row.attempts >= max ? 2 : 1;
    };

    entries.sort((a, b) => {
      const d = bucket(a) - bucket(b);
      if (d !== 0) return d;
      if (a.row?.solved && b.row?.solved) {
        return (
          a.row.attempts - b.row.attempts || a.row.updatedAt - b.row.updatedAt
        );
      }
      // 푸는 중이면 많이 진행한 쪽이 위
      return (b.row?.attempts ?? 0) - (a.row?.attempts ?? 0);
    });

    // 등수는 푼 사람에게만 매긴다
    let n = 0;
    return entries.map((e) => ({
      ...e,
      rank: e.row?.solved ? ++n : null,
    }));
  }, [members, rows, max]);

  return (
    <div className={`game${kind === "baseball" ? " bb" : ""}`}>
      <div className="game-tries">
        {done ? (
          solved ? (
            <b className="ok">{attempts.length}번 만에 성공</b>
          ) : (
            <b className="no">기회를 다 썼어요</b>
          )
        ) : (
          <>
            남은 시도 <b>{left}</b>번
          </>
        )}
      </div>

      <div className="game-board">
        {[...attempts, ...(done ? [] : [null])].map((a, i) => {
          const text = a?.guess ?? (done ? "" : input);
          return (
            <div className={`g-row${a ? "" : " typing"}`} key={i}>
              {Array.from({ length: len }, (_, j) => (
                <div
                  key={j}
                  className={`g-cell${a ? ` ${a.marks[j] ?? "done"}` : ""}${
                    !a && text[j] ? " filled" : ""
                  }`}
                >
                  {(text[j] ?? "").toUpperCase()}
                </div>
              ))}
              {a?.score && (
                <div className="g-score">
                  {a.score.strike === 0 && a.score.ball === 0 ? (
                    <span className="out">아웃</span>
                  ) : (
                    <>
                      {a.score.strike > 0 && (
                        <span className="s">{a.score.strike}S</span>
                      )}
                      {a.score.ball > 0 && (
                        <span className="b">{a.score.ball}B</span>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {toast && <div className="game-toast">{toast}</div>}

      {done && !solved && (
        <div className="game-result">
          정답은 <b>{secret.toUpperCase()}</b> 였어요
        </div>
      )}

      {!done && (
        <div className="game-keys">
          {(kind === "wordle" ? KEYS : DIGITS).map((row, i) => (
            <div className="k-row" key={i}>
              {i === (kind === "wordle" ? 2 : 1) && (
                <button className="key wide" onClick={submit}>
                  확인
                </button>
              )}
              {row.split("").map((ch) => (
                <button
                  key={ch}
                  className={`key${kb[ch] ? ` ${kb[ch]}` : ""}`}
                  onClick={() => type(ch)}
                >
                  {ch.toUpperCase()}
                </button>
              ))}
              {i === (kind === "wordle" ? 2 : 1) && (
                <button
                  className="key wide"
                  onClick={() => setInput(input.slice(0, -1))}
                >
                  ←
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="game-friends">
        <div className="gf-title">
          {ranked.some((r) => r.row?.solved) ? "오늘의 순위" : "같이 푸는 중"}
        </div>
        {ranked.map(({ member, row, rank }) => {
          const isMe = member.id === meId;
          const failed = row && !row.solved && row.attempts >= max;
          return (
            <div className={`gf-row${isMe ? " me" : ""}`} key={member.id}>
              <div className="gf-rank">{rank ?? ""}</div>
              <Face profile={member.profile} className="gf-face" />
              <div className="gf-name">
                {member.name}
                {isMe && <span className="gf-me">나</span>}
              </div>
              <div className="gf-dots">
                {(row?.marks ?? []).map((_, i) => (
                  <span
                    key={i}
                    className={`gf-dot${
                      i === (row?.marks.length ?? 0) - 1 && row?.solved
                        ? " win"
                        : ""
                    }`}
                  />
                ))}
              </div>
              <div className={`gf-state${row?.solved ? " ok" : ""}`}>
                {row?.solved
                  ? `${row.attempts}번`
                  : failed
                    ? "실패"
                    : row
                      ? `${row.attempts}/${max}`
                      : "아직"}
              </div>
            </div>
          );
        })}
      </div>

      <div className="game-foot">
        {kind === "wordle"
          ? `${WORDLE.length}글자 영어 단어 · ${WORDLE.maxAttempts}번`
          : `서로 다른 숫자 ${BASEBALL.length}개 · ${BASEBALL.maxAttempts}번`}
        {" · "}
        같은 방이면 모두 같은 문제예요
      </div>
    </div>
  );
}
