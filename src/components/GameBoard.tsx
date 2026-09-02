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

  const rowsToDraw = Array.from({ length: max }, (_, i) => attempts[i] ?? null);
  const others = rows.filter((r) => r.userId !== meId);

  return (
    <div className={`game${kind === "baseball" ? " bb" : ""}`}>
      <div className="game-board">
        {rowsToDraw.map((a, i) => {
          const text =
            a?.guess ?? (i === attempts.length && !done ? input : "");
          return (
            <div className="g-row" key={i}>
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

      {done && (
        <div className={`game-result${solved ? " win" : ""}`}>
          {solved ? (
            <>
              <b>{attempts.length}번</b> 만에 맞혔어요
            </>
          ) : (
            <>
              오늘은 못 맞혔어요 · 정답은{" "}
              <b>{secret.toUpperCase()}</b>
            </>
          )}
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
        <div className="gf-title">같이 푸는 중</div>
        {others.length === 0 && (
          <div className="gf-empty">아직 아무도 시작 안 했어요</div>
        )}
        {others.map((r) => {
          const m = members.find((x) => x.id === r.userId);
          return (
            <div className="gf-row" key={r.userId}>
              {m && <Face profile={m.profile} className="gf-face" />}
              <div className="gf-name">{m?.name ?? "누군가"}</div>
              <div className="gf-dots">
                {r.marks.map((mk, i) => (
                  <span
                    key={i}
                    className={`gf-dot${
                      kind === "wordle"
                        ? mk === "h".repeat(wordLength("wordle"))
                          ? " win"
                          : ""
                        : mk.startsWith(String(BASEBALL.length))
                          ? " win"
                          : ""
                    }`}
                  />
                ))}
              </div>
              <div className="gf-state">
                {r.solved
                  ? `${r.attempts}번`
                  : r.attempts >= max
                    ? "실패"
                    : `${r.attempts}/${max}`}
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
