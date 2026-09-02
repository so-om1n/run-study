/**
 * node --test 로 돈다 (npm test).
 * 채점은 게임의 심장이라 여기가 틀리면 아무것도 못 믿는다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { evaluateWordle, evaluateBaseball, isWellFormed, keyboardMarks } from "./rules.ts";
import { dailyWord, dailyNumber, isRealWord, ANSWER_COUNT } from "./daily.ts";

test("워들 — 전부 맞음", () => {
  assert.deepEqual(evaluateWordle("crane", "crane"), [
    "hit", "hit", "hit", "hit", "hit",
  ]);
});

test("워들 — 자리만 틀린 글자", () => {
  assert.deepEqual(evaluateWordle("crane", "nacre"), [
    "near", "near", "near", "near", "hit",
  ]);
});

test("워들 — 정답에 없는 중복 글자를 있다고 하면 안 된다", () => {
  // 정답 SPEED 에 E 는 둘. ERASE 의 E 는 셋.
  // 자리 맞은 E(4번째)를 먼저 소모하면 남은 건 하나뿐이다.
  const marks = evaluateWordle("speed", "erase");
  assert.equal(marks.filter((m) => m !== "miss").length, 3);
  assert.deepEqual(marks, ["near", "miss", "miss", "near", "near"]);
});

test("워들 — 정답에 한 번뿐인 글자를 두 번 넣으면 하나만 표시", () => {
  const marks = evaluateWordle("abbey", "babes");
  assert.equal(marks.filter((m) => m === "hit" || m === "near").length, 4);
});

test("숫자야구 — 스트라이크와 볼", () => {
  assert.deepEqual(evaluateBaseball("1234", "1243"), { strike: 2, ball: 2 });
  assert.deepEqual(evaluateBaseball("1234", "5678"), { strike: 0, ball: 0 });
  assert.deepEqual(evaluateBaseball("1234", "4321"), { strike: 0, ball: 4 });
});

test("입력 형식", () => {
  assert.equal(isWellFormed("wordle", "crane"), true);
  assert.equal(isWellFormed("wordle", "cran"), false);
  assert.equal(isWellFormed("wordle", "cr4ne"), false);
  assert.equal(isWellFormed("baseball", "1234"), true);
  assert.equal(isWellFormed("baseball", "1123"), false, "숫자가 겹치면 안 됨");
  assert.equal(isWellFormed("baseball", "0123"), true, "0 으로 시작해도 됨");
});

test("키보드 색은 가장 좋은 판정이 남는다", () => {
  const marks = keyboardMarks([
    { guess: "seedy", marks: ["miss", "near", "miss", "miss", "miss"] },
    { guess: "brine", marks: ["miss", "miss", "miss", "miss", "hit"] },
  ]);
  assert.equal(marks.e, "hit");
});

test("오늘의 정답은 같은 방·같은 날이면 항상 같다", () => {
  const a = dailyWord("party-1", "2026-09-02");
  const b = dailyWord("party-1", "2026-09-02");
  assert.equal(a, b);
});

test("방이 다르면 정답도 다르다", () => {
  const a = dailyWord("party-1", "2026-09-02");
  const b = dailyWord("party-2", "2026-09-02");
  assert.notEqual(a, b);
});

test("날이 바뀌면 정답도 바뀐다", () => {
  const a = dailyWord("party-1", "2026-09-02");
  const b = dailyWord("party-1", "2026-09-03");
  assert.notEqual(a, b);
});

test("정답은 항상 사전에 있는 5글자다", () => {
  for (let i = 0; i < 300; i++) {
    const w = dailyWord(`p${i}`, "2026-09-02");
    assert.equal(w.length, 5, w);
    assert.ok(isRealWord(w), `${w} 가 허용 목록에 없다`);
  }
});

test("숫자야구 정답은 서로 다른 숫자 4개", () => {
  for (let i = 0; i < 300; i++) {
    const n = dailyNumber(`p${i}`, "2026-09-02");
    assert.equal(n.length, 4, n);
    assert.equal(new Set(n).size, 4, `${n} 에 중복 숫자`);
  }
});

test("정답이 목록 전체에 고르게 퍼진다", () => {
  // 해시가 망가지면 몇 개 단어만 계속 나온다. 그걸 잡는 테스트.
  const seen = new Set<string>();
  for (let i = 0; i < 2000; i++) seen.add(dailyWord(`party-${i}`, "2026-09-02"));
  assert.ok(
    seen.size > ANSWER_COUNT * 0.4,
    `2000번 뽑았는데 서로 다른 단어가 ${seen.size}개뿐 (전체 ${ANSWER_COUNT})`,
  );
});
