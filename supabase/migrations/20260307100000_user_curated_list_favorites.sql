-- User favorite curated lists (keşfet listelerini favorilere ekleme)
create table if not exists user_curated_list_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  curated_list_id uuid not null references curated_lists(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, curated_list_id)
);

create index if not exists idx_user_curated_list_favorites_user
  on user_curated_list_favorites(user_id);

alter table user_curated_list_favorites enable row level security;

create policy "Users can manage own curated list favorites"
  on user_curated_list_favorites for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
