-- run study — Supabase 스키마
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 실행하세요.
-- (Authentication → Providers → Anonymous sign-ins 를 먼저 켜야 합니다)

-- ============================================================
-- 1. 테이블
-- ============================================================

-- 프로필: auth.users 와 1:1. 상태 메시지도 여기 산다.
-- (프레즌스는 휘발성이라 "지금 온라인인가"만 담고, 남아야 하는 건 전부 DB)
create table if not exists public.profile (
  id                 uuid primary key references auth.users on delete cascade,
  name               text not null default '이름 없음',
  handle             text,
  character_color    text default '#F0C96B',
  photo              text,                       -- dataURL. 커지면 Storage 로 옮길 것
  shape              text not null default 'cloud',
  crop               jsonb not null default '{"zoom":1,"x":50,"y":50}'::jsonb,
  background         text not null default '#F7EBD3',
  background_is_dark boolean not null default false,

  -- 상태 메시지
  status_text        text,
  status_emoji       text,
  status_expires_at  timestamptz,
  -- 상태 메시지가 바뀔 때마다 새로 발급된다. 반응은 이 값에 매달린다.
  status_id          uuid not null default gen_random_uuid(),

  updated_at         timestamptz not null default now()
);

create table if not exists public.party (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default '우리끼리',
  code       text not null unique,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.party_member (
  party_id  uuid not null references public.party on delete cascade,
  user_id   uuid not null references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (party_id, user_id)
);

-- 반응은 "누가 / 누구의 / 어떤 상태 메시지에 / 무엇을" 달았는지를 다 남긴다.
-- status_id 를 물고 있어서 상태 메시지가 바뀌면 자연스럽게 옛 반응이 된다.
create table if not exists public.reaction (
  id             uuid primary key default gen_random_uuid(),
  party_id       uuid not null references public.party on delete cascade,
  target_user_id uuid not null references auth.users on delete cascade,
  target_status  uuid not null,
  emoji          text not null,
  by_user_id     uuid not null references auth.users on delete cascade,
  created_at     timestamptz not null default now(),
  -- 같은 사람이 같은 이모지를 두 번 달 수는 없다
  unique (target_user_id, target_status, emoji, by_user_id)
);

create index if not exists reaction_party_idx on public.reaction (party_id);
create index if not exists party_member_user_idx on public.party_member (user_id);

-- ============================================================
-- 2. 상태 메시지가 바뀌면 status_id 를 새로 발급 + 옛 반응 정리
-- ============================================================
create or replace function public.rotate_status_id()
returns trigger language plpgsql as $$
begin
  if new.status_text is distinct from old.status_text then
    new.status_id := gen_random_uuid();
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profile_rotate_status on public.profile;
create trigger profile_rotate_status
  before update on public.profile
  for each row execute function public.rotate_status_id();

-- 더 이상 유효하지 않은 반응은 지운다
create or replace function public.purge_stale_reactions()
returns trigger language plpgsql security definer as $$
begin
  delete from public.reaction
   where target_user_id = new.id
     and target_status <> new.status_id;
  return null;
end $$;

drop trigger if exists profile_purge_reactions on public.profile;
create trigger profile_purge_reactions
  after update of status_id on public.profile
  for each row execute function public.purge_stale_reactions();

-- ============================================================
-- 3. 헬퍼 — "나와 같은 파티인가"
--    RLS 정책 안에서 party_member 를 직접 조회하면 재귀가 걸려서
--    security definer 함수로 우회한다.
-- ============================================================
create or replace function public.shares_party_with(other uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1
      from public.party_member a
      join public.party_member b on a.party_id = b.party_id
     where a.user_id = auth.uid()
       and b.user_id = other
  );
$$;

create or replace function public.is_party_member(p uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.party_member
     where party_id = p and user_id = auth.uid()
  );
$$;

-- ============================================================
-- 4. 파티 만들기 / 코드로 참여
--    참여 전에는 그 파티를 select 할 권한이 없으므로 함수로 처리한다.
-- ============================================================
create or replace function public.create_party(p_name text)
returns public.party language plpgsql security definer as $$
declare
  new_code text;
  row public.party;
begin
  loop
    -- 헷갈리는 글자(0,O,1,I)는 뺀 6자리
    new_code := (
      select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
                               (random() * 31)::int + 1, 1), '')
        from generate_series(1, 6)
    );
    exit when not exists (select 1 from public.party where code = new_code);
  end loop;

  insert into public.party (name, code, created_by)
  values (coalesce(nullif(p_name, ''), '우리끼리'), new_code, auth.uid())
  returning * into row;

  insert into public.party_member (party_id, user_id)
  values (row.id, auth.uid());

  return row;
end $$;

create or replace function public.join_party(p_code text)
returns public.party language plpgsql security definer as $$
declare
  row public.party;
begin
  select * into row from public.party where code = upper(trim(p_code));
  if not found then
    raise exception '그런 코드의 파티가 없어요';
  end if;

  insert into public.party_member (party_id, user_id)
  values (row.id, auth.uid())
  on conflict do nothing;

  return row;
end $$;

-- ============================================================
-- 5. RLS
--    익명 로그인도 진짜 auth.uid() 를 받으므로 정책이 그대로 성립한다.
-- ============================================================
alter table public.profile      enable row level security;
alter table public.party        enable row level security;
alter table public.party_member enable row level security;
alter table public.reaction     enable row level security;

-- 프로필: 나 + 같은 파티 사람만 보고, 고치는 건 나만
drop policy if exists profile_select on public.profile;
create policy profile_select on public.profile for select
  using (id = auth.uid() or public.shares_party_with(id));

drop policy if exists profile_insert on public.profile;
create policy profile_insert on public.profile for insert
  with check (id = auth.uid());

drop policy if exists profile_update on public.profile;
create policy profile_update on public.profile for update
  using (id = auth.uid()) with check (id = auth.uid());

-- 파티: 내가 속한 것만
drop policy if exists party_select on public.party;
create policy party_select on public.party for select
  using (public.is_party_member(id));

drop policy if exists member_select on public.party_member;
create policy member_select on public.party_member for select
  using (public.is_party_member(party_id));

drop policy if exists member_delete on public.party_member;
create policy member_delete on public.party_member for delete
  using (user_id = auth.uid());          -- 나가는 건 나만

-- 반응: 같은 파티면 보이고, 다는 건 내 이름으로만, 떼는 것도 내 것만
drop policy if exists reaction_select on public.reaction;
create policy reaction_select on public.reaction for select
  using (public.is_party_member(party_id));

drop policy if exists reaction_insert on public.reaction;
create policy reaction_insert on public.reaction for insert
  with check (by_user_id = auth.uid() and public.is_party_member(party_id));

drop policy if exists reaction_delete on public.reaction;
create policy reaction_delete on public.reaction for delete
  using (by_user_id = auth.uid());

-- ============================================================
-- 6. 방 관리 — 이름 바꾸기 / 방 없애기
--    나가기는 이미 member_delete 로 되어 있다 (나만 나갈 수 있음).
--    여기서 더 필요한 건 방장 권한이다.
-- ============================================================

create or replace function public.is_party_owner(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.party where id = p and created_by = auth.uid()
  );
$$;

drop policy if exists party_update on public.party;
create policy party_update on public.party for update
  using (public.is_party_owner(id))
  with check (public.is_party_owner(id));

drop policy if exists party_delete on public.party;
create policy party_delete on public.party for delete
  using (public.is_party_owner(id));

-- ============================================================
-- 7. 미니게임 진행도
--
--    정답은 여기 저장하지 않는다. 같은 파티원이 읽을 수 있는 자리에
--    두면 그게 곧 커닝 경로가 된다. 정답은 각자 기기에서
--    (파티 ID + 날짜 + 게임)을 해시해서 뽑는다 — src/lib/game/daily.ts
--
--    저장하는 건 "몇 번 만에 어떻게 풀었나" 뿐이다.
--    marks 는 채점 결과 패턴("hit,near,miss,...")만 담는다.
--    남의 추측 단어 자체는 안 넘긴다 — 그게 넘어가면 답이 새니까.
-- ============================================================

create table if not exists public.game_progress (
  party_id   uuid not null references public.party on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  kind       text not null check (kind in ('wordle', 'baseball')),
  day        date not null,
  attempts   int  not null default 0 check (attempts >= 0 and attempts <= 20),
  solved     boolean not null default false,
  -- 각 시도의 채점 결과. 워들은 "hit,near,miss.." 5개, 야구는 "2S1B" 같은 것
  marks      text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (party_id, user_id, kind, day)
);

create index if not exists game_progress_day_idx
  on public.game_progress (party_id, kind, day);

alter table public.game_progress enable row level security;

-- 같은 파티면 서로의 진행도가 보인다. 쓰는 건 내 행만.
drop policy if exists game_select on public.game_progress;
create policy game_select on public.game_progress for select
  using (public.is_party_member(party_id));

drop policy if exists game_insert on public.game_progress;
create policy game_insert on public.game_progress for insert
  with check (user_id = auth.uid() and public.is_party_member(party_id));

drop policy if exists game_update on public.game_progress;
create policy game_update on public.game_progress for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists game_delete on public.game_progress;
create policy game_delete on public.game_progress for delete
  using (user_id = auth.uid());

-- ============================================================
-- 8. 실시간 구독 대상
--    이미 들어가 있으면 42710 에러가 나므로 확인 후 추가한다.
--    (이 파일 전체는 몇 번을 다시 실행해도 안전하다)
-- ============================================================
do $$
declare
  t text;
begin
  foreach t in array array['profile', 'reaction', 'party_member', 'game_progress'] loop
    if not exists (
      select 1
        from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = t
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I', t
      );
    end if;
  end loop;
end $$;
