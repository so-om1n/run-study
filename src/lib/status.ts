import type { ManualStatus, Status } from "../types";

/**
 * 상태 우선순위 — 결정된 규칙:
 *   1. 수동 오프라인  (항상 이김, 앱 재시작해도 유지)
 *   2. 집중 중        (수동으로 켰거나, 타이머가 돌고 있거나)
 *   3. 온라인         (기본값)
 *
 * 해제는 "들어온 문으로 나간다":
 *   - 타이머로 진입한 집중 중 → 타이머 종료 시 자동 해제
 *   - 수동으로 켠 집중 중     → 수동으로만 해제
 *   - 수동 오프라인           → 수동으로만 해제
 */
export function resolveStatus(
  manual: ManualStatus,
  timerRunning: boolean,
): Status {
  if (manual === "offline") return "offline";
  if (manual === "focus" || timerRunning) return "focus";
  return "online";
}

export const STATUS_COLOR: Record<Status, string> = {
  online: "var(--green)",
  focus: "var(--red)",
  offline: "var(--gray)",
};

export const STATUS_LABEL: Record<Status, string> = {
  online: "온라인",
  focus: "집중 중",
  offline: "오프라인",
};

/** 초 → 00:00:00 */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

/** 격자: 항상 최대 3열, 마지막 줄은 가운데 정렬(CSS가 처리) */
export const MAX_COLUMNS = 3;

/** 만료 시각을 사람이 읽는 문장으로 */
export function formatExpiry(expiresAt: number | null): string {
  if (expiresAt === null) return "지우지 않음";
  const d = new Date(expiresAt);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${sameDay ? "오늘" : "내일"} ${time}에 삭제`;
}

export const EXPIRY_OPTIONS: { label: string; hours: number | null }[] = [
  { label: "30분", hours: 0.5 },
  { label: "1시간", hours: 1 },
  { label: "4시간", hours: 4 },
  { label: "하루", hours: 24 },
  { label: "지우지 않음", hours: null },
];

/**
 * 만료된 상태 메시지인가.
 *
 * 만료 시각을 저장만 하고 아무도 보지 않으면, 지정한 시간이 지나도
 * 메시지가 그대로 남고 거기 달린 반응도 같이 남는다.
 */
export function isExpired(
  message: { expiresAt: number | null } | null,
  now = Date.now(),
): boolean {
  return message?.expiresAt != null && message.expiresAt <= now;
}
