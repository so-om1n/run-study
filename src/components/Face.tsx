import type { Profile, Status } from "../types";
import { STATUS_COLOR } from "../lib/status";

export const SHAPE_CLASS: Record<Profile["shape"], string> = {
  cloud: "s-cloud",
  circle: "s-circle",
  squircle: "s-squircle",
  leaf: "s-leaf",
  heart: "s-heart",
  star: "s-star",
};

interface Props {
  profile: Profile;
  status?: Status;
  className?: string;
  dotClassName?: string;
}

/**
 * 캐릭터 얼굴.
 * 사진이 있으면 얼굴 실루엣 모양대로 잘려 들어간다.
 * 어디를 어떻게 자를지는 profile.crop (확대 + 중심 위치)이 결정한다.
 */
export function Face({ profile, status, className, dotClassName }: Props) {
  const shape = SHAPE_CLASS[profile.shape];
  const hasPhoto = Boolean(profile.photo);

  return (
    <div className={className ?? "blob"}>
      <div
        className={`shape ${shape}`}
        style={{ background: profile.characterColor ?? "#C2BDD1" }}
      >
        {hasPhoto && (
          <img
            src={profile.photo!}
            alt=""
            draggable={false}
            style={{
              objectPosition: `${profile.crop.x}% ${profile.crop.y}%`,
              transform: `scale(${profile.crop.zoom})`,
            }}
          />
        )}
      </div>
      {!hasPhoto && (
        <div className="eyes">
          <i />
          <i />
        </div>
      )}
      {status && (
        <span
          className={dotClassName ?? "dot"}
          style={{ background: STATUS_COLOR[status] }}
        />
      )}
    </div>
  );
}
