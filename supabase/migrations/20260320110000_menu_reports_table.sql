-- Menu reports table (for "Menüyü Bildir" feature)
create table if not exists menu_reports (
  id uuid primary key default gen_random_uuid(),
  menu_entry_id uuid not null references menu_entries(id) on delete cascade,
  reported_by uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  details text,
  created_at timestamptz default now()
);

create index if not exists idx_menu_reports_menu_entry on menu_reports(menu_entry_id);
create index if not exists idx_menu_reports_reported_by on menu_reports(reported_by);

-- One report per user per menu
create unique index if not exists menu_reports_user_menu_unique
  on menu_reports(menu_entry_id, reported_by);
