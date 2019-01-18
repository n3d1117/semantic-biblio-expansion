DROP TABLE IF EXISTS records;
DROP TABLE IF EXISTS expanded_records;

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
  link TEXT
);

CREATE TABLE expanded_records (
  id INTEGER PRIMARY KEY,
  viaf_id TEXT,
  author_other_works TEXT,
  author_wiki_page TEXT,
  author_wiki_info TEXT,
  FOREIGN KEY (id) REFERENCES records (id)
);
