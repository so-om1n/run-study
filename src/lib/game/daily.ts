/**
 * 오늘의 정답을 정한다.
 *
 * 서버가 없기 때문에 "랜덤"을 쓰면 안 된다. 각자 자기 기기에서 뽑으면
 * 사람마다 다른 문제를 풀게 되고, 같이 하는 의미가 사라진다.
 * 그래서 파티 ID + 날짜 + 게임 종류를 해시해서 목록의 인덱스로 쓴다.
 * 같은 방, 같은 날이면 누가 어디서 열어도 같은 답이 나온다.
 *
 * 정답은 DB 에 저장하지 않는다. 저장하면 같은 파티원은 그 행을 읽을 수
 * 있어서 오히려 더 쉽게 새기 때문이다. 대신 각자 여기서 계산한다.
 * (개발자도구를 열면 볼 수는 있다. 친구끼리 하는 게임이라 그 선까지만
 *  막는다. 서버 채점이 필요해지면 submit_guess RPC 로 옮기면 된다)
 */

import words from "./words.json" with { type: "json" };
import type { GameKind } from "./rules.ts";
import { BASEBALL } from "./rules.ts";

const ANSWERS = words.answers.split(" ");
const ALLOWED = new Set(words.allowed.split(" "));

/** 사전에 있는 단어인지 */
export function isRealWord(guess: string): boolean {
  return ALLOWED.has(guess.toLowerCase());
}

/**
 * 문자열 → 32비트 정수. FNV-1a.
 *
 * 암호용이 아니다. 필요한 건 "같은 입력이면 같은 값, 입력이 조금
 * 달라지면 값이 확 달라진다" 뿐이고, 이 용도엔 이게 충분하다.
 */
function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    // FNV 소수 곱셈을 32비트 안에서 (Math.imul 이 오버플로를 잘라준다)
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 그 기기의 자정 기준 날짜 키. 친구가 다른 시간대면 하루 어긋날 수 있다. */
export function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function seedFor(partyId: string, kind: GameKind, day = todayKey()) {
  return `${partyId}:${kind}:${day}`;
}

/** 오늘 이 파티의 워들 정답 */
export function dailyWord(partyId: string, day = todayKey()): string {
  return ANSWERS[hash32(seedFor(partyId, "wordle", day)) % ANSWERS.length];
}

/**
 * 오늘 이 파티의 숫자야구 정답. 서로 다른 숫자 4개.
 *
 * 시드로 초기화한 의사난수로 섞는다. Fisher-Yates 를 쓰되 난수원이
 * 시드에서만 나오므로 결과가 항상 같다.
 */
export function dailyNumber(partyId: string, day = todayKey()): string {
  let state = hash32(seedFor(partyId, "baseball", day));
  const next = () => {
    // xorshift32. 시드가 같으면 수열도 같다
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state;
  };

  const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = digits.length - 1; i > 0; i--) {
    const j = next() % (i + 1);
    [digits[i], digits[j]] = [digits[j], digits[i]];
  }
  return digits.slice(0, BASEBALL.length).join("");
}

export function dailySecret(
  partyId: string,
  kind: GameKind,
  day = todayKey(),
): string {
  return kind === "wordle" ? dailyWord(partyId, day) : dailyNumber(partyId, day);
}

export const ANSWER_COUNT = ANSWERS.length;
export const ALLOWED_COUNT = ALLOWED.size;
