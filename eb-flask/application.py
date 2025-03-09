import base64
import boto3
from botocore.exceptions import ClientError
from datetime import datetime
from flask import Flask, request, jsonify
import json
import psycopg2 as pg
import psycopg2.extras as pg_extras
from whoosh import index
from whoosh import qparser

application = Flask(__name__)

def get_pg_secret():
    secret_name = "rds!db-087d55ac-2a56-4890-84e2-077ddf7542c8"
    region_name = "us-east-2"

    # Create a Secrets Manager client
    session = boto3.session.Session()
    client = session.client(
        service_name='secretsmanager',
        region_name=region_name
    )

    try:
        get_secret_value_response = client.get_secret_value(SecretId=secret_name)
    except ClientError as e:
        # For a list of exceptions thrown, see
        # https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
        raise e

    return json.loads(get_secret_value_response['SecretString'])

def create_pg_conn():
    pg_secret = get_pg_secret()
    return pg.connect(
        database="reports",
        user=pg_secret["username"],
        password=pg_secret["password"],
        host="reports.c786ks06yy45.us-east-2.rds.amazonaws.com",
        port=5432,
    )

@application.route("/")
def hello():
    return "<p>I'm a teapot</p>", 418

@application.route("/v1/reports")
def list_reports():
    try:
        pg_conn = create_pg_conn()
    except Exception as e:
        return jsonify({"error": "error connecting to database"}), 503

    title = request.args.get('title')
    source = request.args.get('source')
    published_after = request.args.get('published_after')
    published_before = request.args.get('published_before')
    page_token = request.args.get('page_token')
    limit = request.args.get('limit', 10, type=int)

    query = """
        SELECT id, title, source, publish_time, web_url
        FROM report
        WHERE 1=1
    """
    params = []

    if title:
        query += " AND title ILIKE %s"
        params.append(f'%{title}%')

    if source:
        query += " AND source ILIKE %s"
        params.append(f'%{source}%')

    if published_after:
        try:
            # Convert to datetime object if it's a timestamp string
            if published_after.isdigit():
                published_after = datetime.fromtimestamp(int(start_time))
            query += " AND publish_time > %s"
            params.append(published_after)
        except (ValueError, TypeError):
            return jsonify({"error": "invalid published_after format"}), 400

    if published_before:
        try:
            # Convert to datetime object if it's a timestamp string
            if published_before.isdigit():
                published_before = datetime.fromtimestamp(int(published_before))
            query += " AND publish_time < %s"
            params.append(published_before)
        except (ValueError, TypeError):
            return jsonify({"error": "invalid published_before format"}), 400

    # Handle pagination
    if page_token:
        try:
            # Decode the page token
            decoded_token = json.loads(base64.b64decode(page_token).decode('utf-8'))
            last_publish_time = decoded_token.get('last_publish_time')
            last_id = decoded_token.get('last_id')

            if last_publish_time and last_id:
                # Add condition to get records after the last seen record
                query += """ AND (publish_time < %s
                          OR (publish_time = %s AND id < %s))"""
                params.extend([last_publish_time, last_publish_time, last_id])
        except Exception:
            return jsonify({"error": "invalid page token"}), 400

    query += " ORDER BY publish_time DESC, id DESC LIMIT %s + 1"
    params.append(limit)

    results = []
    try:
        with pg_conn, pg_conn.cursor(cursor_factory=pg_extras.DictCursor) as pg_cur:
            pg_cur.execute(query, params)
            rows = pg_cur.fetchall()

            has_more = len(rows) > limit
            if has_more:
                rows = rows[:-1]

            for row in rows:
                results.append({
                    "id": row["id"],
                    "title": row["title"],
                    "publish_time": row["publish_time"].isoformat() if row["publish_time"] else None,
                    "source": row["source"],
                    "web_url": row["web_url"],
                })

            # Generate the next page token
            next_page_token = None
            if has_more and results:
                last_result = results[-1]
                token_data = {
                    "last_publish_time": last_result["publish_time"],
                    "last_id": last_result["id"]
                }
                next_page_token = base64.b64encode(json.dumps(token_data).encode('utf-8')).decode('utf-8')
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        pg_conn.close()

    response = {
        "reports": results,
    }
    if next_page_token:
        response["next_page_token"] = next_page_token

    return jsonify(response)

@application.route("/v1/reports/<string:report_id>")
def get_report(report_id):
    try:
        pg_conn = create_pg_conn()
    except Exception as e:
        return jsonify({"error": "error connecting to database"}), 503

    query = """
        SELECT
            id,
            publish_time,
            title,
            summary,
            source,
            ipv4s,
            ipv6s,
            urls,
            yara_rules,
            cves,
            sha256s,
            md5s,
            sha1s,
            mitre,
            web_url
        FROM report
        WHERE id = %s
    """
    try:
        with pg_conn, pg_conn.cursor(cursor_factory=pg_extras.DictCursor) as pg_cur:
            pg_cur.execute(query, (report_id,))
            row = pg_cur.fetchone()

            if not row:
                return jsonify({"error": "report not found"}), 404

            result = dict(row)

            if result["publish_time"] is not None:
                result["publish_time"] = result["publish_time"].isoformat()

            # Handle arrays - ensure they're returned as lists even if NULL in DB
            array_fields = ["ipv4s", "ipv6s", "urls", "yara_rules", "cves", "sha256s", "md5s", "sha1s"]
            for field in array_fields:
                if result[field] is None:
                    result[field] = []

            # Handle the mitre JSON field - it's already loaded as a Python dict by psycopg2.extras.DictCursor
            # but we need to ensure it's not None
            if result["mitre"] is None:
                result["mitre"] = {}

            return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        pg_conn.close()

@application.route("/v1/reports/search")
def search_reports():
    try:
        ix = index.open_dir("pageindex", indexname="report", readonly=True)
    except:
        return jsonify({"error": "error connecting to index"}), 503

    try:
        pg_conn = create_pg_conn()
    except Exception as e:
        return jsonify({"error": "error connecting to database"}), 503

    query_str = request.args.get('q')
    limit = request.args.get('limit', 10, type=int)
    page_token = request.args.get('page_token')

    if not query_str:
        return jsonify({"error": "query field 'q' is required"}), 400

    pagenum = 1
    if page_token:
        try:
            pagenum = int(base64.b64decode(page_token))
        except Exception:
            return jsonify({"error": "invalid page token"}), 400

    reports = []
    try:
        with ix.searcher() as searcher, pg_conn.cursor(cursor_factory=pg_extras.DictCursor) as pg_cur:
            parser = qparser.MultifieldParser(["title", "content"],
                                             ix.schema,
                                             fieldboosts={"title": 2.0,
                                                          "content": 1.0})
            query = parser.parse(query_str)
            results = searcher.search_page(query, pagenum, pagelen=limit)

            for hit in results:
                report_id = hit["id"]
                pg_cur.execute("""
                    SELECT id, title, source, publish_time, web_url
                    FROM report
                    WHERE id = %s
                """, (report_id,))
                row = pg_cur.fetchone()

                if not row:
                    return jsonify({"error": f"could not find record {report_id}"}), 503

                reports.append({
                    "id": row["id"],
                    "title": row["title"],
                    "publish_time": row["publish_time"].isoformat() if row["publish_time"] else None,
                    "source": row["source"],
                    "web_url": row["web_url"],
                })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        pg_conn.close()

    next_page_token = base64.b64encode(str(pagenum+1).encode()).decode()
    response = {
        "reports": reports,
        "next_page_token": next_page_token,
    }

    return jsonify(response)

if __name__ == '__main__':
    application.debug = True
    application.run()
