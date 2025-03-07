BEGIN;

CREATE TABLE IF NOT EXISTS report (
    id TEXT PRIMARY KEY,
    publish_time INTEGER, -- epoch
    title TEXT UNIQUE,
    summary TEXT,
    upload_time INTEGER, -- epoch
    source TEXT,
    ipv4s TEXT, -- csv list
    ipv6s TEXT, -- csv list
    urls TEXT, -- csv list
    yara_rules TEXT, -- json list
    cves TEXT, -- csv list
    sha256s TEXT, -- csv list
    md5s TEXT, -- csv list
    sha1s TEXT, -- csv list
    mitre TEXT, -- json
    report_type TEXT,
    web_url TEXT UNIQUE,
    report_data_url TEXT UNIQUE
);

CREATE INDEX IF NOT EXISTS report_publish_time_idx ON report (publish_time);
CREATE INDEX IF NOT EXISTS report_source_idx ON report (source);

COMMIT;