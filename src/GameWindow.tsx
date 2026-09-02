import { useEffect, useState } from "react";
import type { GameRow, PresenceClient } from "./lib/presence";
import { createPresence } from "./lib/presence";
import type { Member } from "./types";
import type { GameKind } from "./lib/game/rules";
import { todayKey } from "./lib/game/daily";
import { GameBoard } from "./components/GameBoard";

/**
 * 미니게임 창.
 *
 * 팝오버와 같은 번들을 쓰고 해시(#game)로 갈린다. 창을 따로 띄우는 이유:
 *   - 팝오버(382×460)에는 보드 + 키보드가 안 들어간다
 *   - 팝오버는 포커스를 잃으면 닫힌다. 게임 중에 사라지면 안 된다
 *
 * presence 는 track=false 로 붙는다. 같은 계정으로 두 창이 붙는데 둘 다
 * 온라인 상태를 실어 보내면 presence key 가 겹쳐 서로 덮어쓴다.
 */
export function GameWindow() {
  const [client, setClient] = useState<PresenceClient | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [partyName, setPartyName] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [kind, setKind] = useState<GameKind>("wordle");
  const [rows, setRows] = useState<GameRow[]>([]);

  useEffect(() => {
    let stop: (() => void) | null = null;
    let alive = true;

    void (async () => {
      const res = await createPresence({ track: false });
      if (!alive) return;
      if (!res.ok) {
        setFatal(res.error);
        return;
      }
      setClient(res.client);
      stop = await res.client.start((snap) => {
        setPartyId(snap.party?.id ?? null);
        setPartyName(snap.party?.name ?? "");
        setMembers(snap.party?.members ?? []);
      });
    })();

    return () => {
      alive = false;
      stop?.();
    };
  }, []);

  // 게임이나 방이 바뀌면 구독을 갈아끼운다
  useEffect(() => {
    if (!client || !partyId) return;
    let stop: (() => void) | null = null;
    let alive = true;
    void client.watchGame(kind, todayKey(), (r) => {
      if (alive) setRows(r);
    }).then((fn) => {
      if (alive) stop = fn;
      else fn();
    });
    return () => {
      alive = false;
      stop?.();
    };
  }, [client, partyId, kind]);

  if (fatal) {
    return (
      <div className="game-window">
        <div className="fatal">
          <h3>연결하지 못했어요</h3>
          <p>{fatal}</p>
        </div>
      </div>
    );
  }

  if (!client || !partyId) {
    return (
      <div className="game-window">
        <div className="fatal">
          <h3>방이 없어요</h3>
          <p>먼저 방을 만들거나 코드로 들어가 주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="game-window">
      <div className="game-tabs">
        <button
          className={`game-tab${kind === "wordle" ? " on" : ""}`}
          onClick={() => setKind("wordle")}
        >
          워들
        </button>
        <button
          className={`game-tab${kind === "baseball" ? " on" : ""}`}
          onClick={() => setKind("baseball")}
        >
          숫자야구
        </button>
        <div className="game-room">{partyName}</div>
      </div>

      <GameBoard
        kind={kind}
        partyId={partyId}
        meId={client.meId}
        members={members}
        rows={rows}
        onProgress={(p) => void client.saveGame(kind, todayKey(), p)}
      />
    </div>
  );
}
