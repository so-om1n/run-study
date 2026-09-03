/** 상태 3종. 오프라인은 앱 실행 여부로 자동 판정되지만 수동 지정도 가능. */
export type Status = "online" | "focus" | "offline";

/** 캐릭터 얼굴 실루엣 */
export type FaceShape =
  | "cloud"
  | "circle"
  | "squircle"
  | "leaf"
  | "heart"
  | "star";

/** 업로드한 사진을 얼굴 모양 안에서 어떻게 자를지 */
export interface Crop {
  /** 확대 배율 (1 = 딱 맞게) */
  zoom: number;
  /** 보이는 중심 (0~100%) */
  x: number;
  y: number;
}

export const DEFAULT_CROP: Crop = { zoom: 1, x: 50, y: 50 };

export interface Profile {
  /** 캐릭터를 쓰면 색, 사진을 쓰면 배경색으로만 쓰임 */
  characterColor: string | null;
  /** 업로드한 사진(dataURL). 있으면 얼굴 모양대로 크롭되어 들어감 */
  photo: string | null;
  shape: FaceShape;
  crop: Crop;
}

/** 누가 어떤 반응을 달았는지. 반응은 상태 메시지에 붙는다. */
export interface Reaction {
  emoji: string;
  /** 단 사람의 멤버 id */
  by: string;
}

/** 셀에 그릴 때 쓰는 묶음 */
export interface StickerGroup {
  emoji: string;
  count: number;
  /** 단 사람들 이름 */
  byNames: string[];
  /** 내가 단 것인지 (누르면 뗄 수 있음) */
  mine: boolean;
}

export interface StatusMessage {
  text: string;
  emoji: string | null;
  /** epoch ms. null 이면 만료 없음 */
  expiresAt: number | null;
}

export interface Member {
  id: string;
  name: string;
  handle: string;
  profile: Profile;
  /** 셀 배경 — 색상 hex 또는 CSS gradient/이미지 url */
  background: string;
  /** 배경이 어두운 이미지면 이름을 흰색으로 */
  backgroundIsDark: boolean;
  status: Status;
  message: StatusMessage | null;
  /** 집중 시작 시각(epoch ms). 집중 중이 아니면 null */
  focusStartedAt: number | null;
  joinedAt: string;
}

export interface Party {
  id: string;
  name: string;
  code: string;
  members: Member[];
}

/**
 * 수동 지정.
 *  - "offline" 은 자동 판정을 항상 이기고, 앱을 껐다 켜도 유지된다.
 *  - "focus" 는 수동으로 해제할 때까지 유지된다 (타이머와 무관).
 *  - null 이면 자동 판정을 따른다.
 */
export type ManualStatus = "focus" | "offline" | null;

export interface Settings {
  autoLaunch: boolean;
  /** 집중 중일 때 macOS 집중 모드 단축어 실행 */
  muteNotifications: boolean;
  /** 상태 메시지 기본 만료 (시간 단위, null = 만료 없음) */
  defaultExpiryHours: number | null;
  /** 타이머 종료 시 (타이머로 진입한) 집중 중 자동 해제 */
  releaseFocusOnTimerEnd: boolean;
  /** 집중 중일 때 얼마나 됐는지를 친구들에게 보여줄지. 기본은 보여줌 */
  shareFocusTime: boolean;
  shortcutName: string;
}

export const PALETTE = [
  "#F7EBD3",
  "#DCEDEA",
  "#F6DAD5",
  "#DDE6F5",
  "#F7DDE6",
  "#E4DFF5",
] as const;

export const CHARACTERS: { shape: FaceShape; color: string; bg: string }[] = [
  { shape: "cloud", color: "#F0C96B", bg: "#F7EBD3" },
  { shape: "circle", color: "#8FCCC1", bg: "#DCEDEA" },
  { shape: "squircle", color: "#E4907A", bg: "#F6DAD5" },
  { shape: "leaf", color: "#A3BCE4", bg: "#DDE6F5" },
  { shape: "heart", color: "#E8A2BC", bg: "#F7DDE6" },
  { shape: "star", color: "#9C8FD4", bg: "#E4DFF5" },
];

/** 상태 설정창을 열 때마다 하나 뽑는 아이스브레이킹 질문 */
export const PROMPTS = [
  "지금 뭐 하는 중?",
  "오늘의 보스몹은?",
  "오늘 이것만 끝내면 성공인 건?",
  "지금 기분을 한 단어로",
  "몇 시까지 버틸 예정?",
  "지금 듣는 노래는?",
  "커피 몇 잔째?",
  "오늘 제일 미루고 있는 건?",
];

export const MAX_MESSAGE_LENGTH = 100;
