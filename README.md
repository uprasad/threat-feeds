# Threat Feeds

Application URL: http://threat-feeds.us-east-2.elasticbeanstalk.com/

Submission for the [SANS AI Cybersecurity Hackathon](https://ai-cybersecurity-hackathon.devpost.com/).

Threat Feeds is a web application that allows users to browse, search and ask
questions about the latest threat reports published across the security
industry.

## Features

1. Filter threat reports by title, source and publish date
1. Full text search across threat report contents
1. Ask AI any questions on the contents of the threat reports
1. Automatic IOC extraction for each threat report
1. Automatic context-based false positive IOC detection for each threat report
1. VirusTotal, NIST and MITRE enrichments for IOCs
1. Related reports or "more like this" feature for each threat report

## Architecture

## Scripts

Jupyter notebooks were used for quick iteration, but are structured in such
a way that they can be run as-is by converting them into Python scripts using
the command
```
jupyter nbconvert --to script <script>.ipynb
```

1. [threat_report_parsing.ipyb](threat_report_parsing.ipynb): Crawl the latest
   pages from [the RSS feeds](feeds.txt), persist the raw page data, parsed
   data and the search index.

## Updating Feeds

Considering this is a hackathon submission, the solution to update the latest
reports is pretty hacky.

1. 

## Future Work

1. User generated content
  - Votes and comments
  - Uplaod custom, private threat reports
  - Share threat reports privately
1. Chatbot for longer conversations about the threat report contents
1. Integrations - OpenCTI, SOAR enrichment plugins etc.
