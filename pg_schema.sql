BEGIN;

CREATE TABLE IF NOT EXISTS report (
    id TEXT PRIMARY KEY,
    publish_time TIMESTAMP WITH TIME ZONE, -- epoch
    title TEXT UNIQUE,
    summary TEXT,
    upload_time TIMESTAMP WITH TIME ZONE, -- epoch
    source TEXT,
    ipv4s TEXT[],
    ipv6s TEXT[],
    urls TEXT[],
    yara_rules TEXT[],
    cves TEXT[],
    sha256s TEXT[],
    md5s TEXT[],
    sha1s TEXT[],
    mitre JSON,
    report_type TEXT,
    web_url TEXT UNIQUE,
    report_data_url TEXT UNIQUE,
    ai_invalid_iocs JSON,
    ai_irrelevant_iocs JSON
);

CREATE INDEX IF NOT EXISTS report_publish_time_idx ON report (publish_time);
CREATE INDEX IF NOT EXISTS report_source_idx ON report (source);

COMMIT;