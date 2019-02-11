DROP TABLE IF EXISTS records;
DROP TABLE IF EXISTS expanded_records;
DROP TABLE IF EXISTS entities;
DROP TABLE IF EXISTS entity_for_record;
DROP TABLE IF EXISTS places;

CREATE TABLE records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  subject TEXT,
  creator TEXT,
  contributor TEXT,
  date TEXT,
  description TEXT,
  language TEXT,
  publisher TEXT,
  type TEXT,
  format TEXT,
  relation TEXT,
  published_in TEXT,
  link TEXT
);

CREATE TABLE expanded_records (
  id INTEGER PRIMARY KEY,
  viaf_id TEXT,
  author_other_works TEXT,
  author_wiki_page TEXT,
  author_wiki_info TEXT,
  FOREIGN KEY (id) REFERENCES records(id)
);

CREATE TABLE entities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id TEXT,
  title TEXT,
  abstract TEXT,
  image_url TEXT,
  coords TEXT,
  uri TEXT
);

CREATE TABLE entity_for_record (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_id INTEGER,
  entity_id INTEGER
);

CREATE TABLE places (
  id TEXT PRIMARY KEY,
  name TEXT,
  coords TEXT
);
