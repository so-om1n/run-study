/**
 * 워들 / 숫자야구 채점.
 *
 * join- 레포의 lib/game.mjs 에서 순수 채점 부분만 가져와 TypeScript 로
 * 옮겼다. 방·세션·서버 관련된 건 전부 뺐다 — 여기선 파티가 그 역할을 한다.
 *
 * 이 파일은 입출력이 없다. 그래서 테스트가 쉽고, 같은 입력이면 어디서
 * 돌려도 같은 답이 나온다.
 */

export type GameKind = "wordle" | "baseball";

/** 워들 한 칸의 판정 */
export type Mark = "hit" | "near" | "miss";

export interface BaseballScore {
  strike: number;
  ball: number;
}

export const WORDLE = {
  length: 5,
  maxAttempts: 6,
} as const;

export const BASEBALL = {
  length: 4,
  maxAttempts: 10,
} as const;

/**
 * 워들 채점.
 *
 * 중복 글자 처리가 이 함수의 전부라고 봐도 된다.
 * 정답 SPEED 에 ERASE 를 넣으면 E 가 세 개인데, 정답에 남은 E 는
 * 두 개뿐이다. 자리를 맞힌 E 를 먼저 소모하고, 남은 개수만큼만
 * near 를 주지 않으면 있지도 않은 글자를 있다고 알려주게 된다.
 */
export function evaluateWordle(secret: string, guess: string): Mark[] {
  const s = secret.toLowerCase();
  const g = guess.toLowerCase();
  const marks: Mark[] = new Array(g.length).fill("miss");

  // 1차: 자리까지 맞은 것부터 소모한다
  const remaining = new Map<string, number>();
  for (let i = 0; i < s.length; i++) {
    if (g[i] === s[i]) {
      marks[i] = "hit";
    } else {
      remaining.set(s[i], (remaining.get(s[i]) ?? 0) + 1);
    }
  }

  // 2차: 남은 개수 안에서만 near
  for (let i = 0; i < g.length; i++) {
    if (marks[i] === "hit") continue;
    const left = remaining.get(g[i]) ?? 0;
    if (left > 0) {
      marks[i] = "near";
      remaining.set(g[i], left - 1);
    }
  }

  return marks;
}

/** 숫자야구 채점. 자리까지 맞으면 스트라이크, 숫자만 맞으면 볼. */
export function evaluateBaseball(secret: string, guess: string): BaseballScore {
  let strike = 0;
  let ball = 0;
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === secret[i]) strike++;
    else if (secret.includes(guess[i])) ball++;
  }
  return { strike, ball };
}

/** 그 게임에서 정답으로 인정되는 입력인지 (형식만 본다) */
export function isWellFormed(kind: GameKind, guess: string): boolean {
  if (kind === "wordle") {
    return new RegExp(`^[a-z]{${WORDLE.length}}$`).test(guess.toLowerCase());
  }
  // 숫자야구는 서로 다른 숫자 4개. 0 으로 시작해도 된다 — 자리 수가 아니라
  // 그냥 네 칸이라서 앞자리를 막을 이유가 없다.
  if (!new RegExp(`^[0-9]{${BASEBALL.length}}$`).test(guess)) return false;
  return new Set(guess).size === BASEBALL.length;
}

export function maxAttempts(kind: GameKind): number {
  return kind === "wordle" ? WORDLE.maxAttempts : BASEBALL.maxAttempts;
}

export function wordLength(kind: GameKind): number {
  return kind === "wordle" ? WORDLE.length : BASEBALL.length;
}

/** 맞혔나 */
export function isSolved(secret: string, guess: string) {
  return secret.toLowerCase() === guess.toLowerCase();
}

/**
 * 워들 키보드에 칠할 색.
 * 같은 글자를 여러 번 썼으면 제일 좋은 판정이 남는다.
 */
export function keyboardMarks(
  guesses: { guess: string; marks: Mark[] }[],
): Record<string, Mark> {
  const rank: Record<Mark, number> = { miss: 0, near: 1, hit: 2 };
  const out: Record<string, Mark> = {};
  for (const { guess, marks } of guesses) {
    for (let i = 0; i < guess.length; i++) {
      const ch = guess[i].toLowerCase();
      const prev = out[ch];
      if (prev === undefined || rank[marks[i]] > rank[prev]) out[ch] = marks[i];
    }
  }
  return out;
}
