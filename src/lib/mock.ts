import type { Member, Party } from "../types";
import { DEFAULT_CROP } from "../types";

const hoursAgo = (h: number) => Date.now() - h * 3600_000;
const inHours = (h: number) => Date.now() + h * 3600_000;

export const ME_ID = "me";

const members: Member[] = [
  {
    id: ME_ID,
    name: "수민",
    handle: "sumin9948",
    profile: { characterColor: "#F0C96B", photo: null, shape: "cloud", crop: DEFAULT_CROP },
    background: "#F7EBD3",
    backgroundIsDark: false,
    status: "online",
    message: {
      text: "논문 3챕터 쓰다가 뇌 녹는 중 오늘 안에 끝내야 하는데 진짜 될까 싶다",
      emoji: null,
      expiresAt: inHours(18),
    },
    focusStartedAt: null,
    joinedAt: "2026년 3월 14일",
  },
  {
    id: "u2",
    name: "지훈",
    handle: "jihoon",
    profile: { characterColor: "#8FCCC1", photo: null, shape: "circle", crop: DEFAULT_CROP },
    background: "#DCEDEA",
    backgroundIsDark: false,
    status: "focus",
    message: { text: "리팩터링 지옥", emoji: null, expiresAt: inHours(4) },
    focusStartedAt: hoursAgo(1.2),
    joinedAt: "2026년 3월 14일",
  },
  {
    id: "u3",
    name: "민아",
    handle: "mina",
    profile: { characterColor: "#E4907A", photo: null, shape: "squircle", crop: DEFAULT_CROP },
    background: "#F6DAD5",
    backgroundIsDark: false,
    status: "online",
    message: null,
    focusStartedAt: null,
    joinedAt: "2026년 4월 2일",
  },
  {
    id: "u4",
    name: "태현",
    handle: "taehyun",
    profile: { characterColor: "#A3BCE4", photo: null, shape: "heart", crop: DEFAULT_CROP },
    background: "#DDE6F5",
    backgroundIsDark: false,
    status: "online",
    message: {
      text: "회의 들어감 살려주세요",
      emoji: null,
      expiresAt: inHours(2),
    },
    focusStartedAt: null,
    joinedAt: "2026년 4월 2일",
  },
  {
    id: "u5",
    name: "현우",
    handle: "hyunwoo",
    profile: { characterColor: "#9C8FD4", photo: null, shape: "star", crop: DEFAULT_CROP },
    background: "linear-gradient(135deg,#FFD3A5,#FD9BAF)",
    backgroundIsDark: true,
    status: "focus",
    message: {
      text: "기말 과제 시작 오늘 밤새서라도 초안까지는 끝낸다",
      emoji: null,
      expiresAt: inHours(9),
    },
    focusStartedAt: hoursAgo(0.7),
    joinedAt: "2026년 5월 20일",
  },
  {
    id: "u6",
    name: "우진",
    handle: "woojin",
    profile: { characterColor: "#B0A7CE", photo: null, shape: "leaf", crop: DEFAULT_CROP },
    background: "#EFEBF7",
    backgroundIsDark: false,
    status: "offline",
    message: null,
    focusStartedAt: null,
    joinedAt: "2026년 5월 20일",
  },
];

export const mockParty: Party = {
  id: "p1",
  name: "우리끼리",
  code: "K7M2QX",
  members,
};
