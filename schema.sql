BEGIN;

CREATE TABLE IF NOT EXISTS report (
    id TEXT PRIMARY KEY,
    creation_time DATETIME,
    title TEXT UNIQUE,
    summary TEXT UNIQUE,
    upload_time DATETIME,
    source INT8, -- enum
    ipv4s BLOB, -- serialized list
    ipv6s BLOB, -- serialized list
    urls BLOB, -- serialized list
    yara_rules BLOB, -- serialized list
    cves BLOB, -- serialized list
    sha256s BLOB, -- serialized list
    md5s BLOB, -- serialized list
    sha1s BLOB, -- serialized list
    mitre TEXT, -- json
    report_type INT8, -- enum
    web_url TEXT UNIQUE,
    report_data_url TEXT UNIQUE
);

CREATE INDEX IF NOT EXISTS report_creation_time_idx ON report (creation_time);
CREATE INDEX IF NOT EXISTS report_source_idx ON report (source);

COMMIT;