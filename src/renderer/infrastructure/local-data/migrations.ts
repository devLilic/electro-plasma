import { LOCAL_DATABASE_VERSION } from '../../domain/media-library'

export const INITIAL_MIGRATION = `
  CREATE TABLE IF NOT EXISTS schema_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS playlist_items (
    id TEXT PRIMARY KEY,
    playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS image_assets (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES playlist_items(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    original_path TEXT NOT NULL,
    processed_path TEXT NOT NULL,
    preview_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    created_at TEXT NOT NULL,
    position INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    slideshow_enabled INTEGER NOT NULL DEFAULT 0,
    slideshow_interval_ms INTEGER,
    transition_type TEXT NOT NULL DEFAULT 'fade',
    transition_duration_ms INTEGER NOT NULL DEFAULT 300
  );

  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS playlist_item_tags (
    item_id TEXT NOT NULL REFERENCES playlist_items(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, tag_id)
  );

  CREATE TABLE IF NOT EXISTS playback_session (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    playlist_id TEXT,
    item_id TEXT,
    status TEXT NOT NULL,
    position_ms INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS playlist_items_playlist_order_idx
    ON playlist_items (playlist_id, order_index);

  CREATE UNIQUE INDEX IF NOT EXISTS image_assets_item_position_idx
    ON image_assets (item_id, position);
`

export const INITIAL_SEED = [
  {
    statement: `
      INSERT INTO schema_meta (key, value)
      VALUES ('version', '${LOCAL_DATABASE_VERSION}')
      ON CONFLICT(key) DO UPDATE SET value = excluded.value;
    `,
  },
  {
    statement: `
      INSERT INTO playback_session (id, playlist_id, item_id, status, position_ms, updated_at)
      VALUES (1, NULL, NULL, 'idle', 0, ?)
      ON CONFLICT(id) DO NOTHING;
    `,
  },
]
