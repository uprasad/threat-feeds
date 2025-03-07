import boto3
from botocore.exceptions import ClientError
from flask import Flask
import json
import psycopg2 as pg

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
def hello_world():
    try:
        pg_conn = create_pg_conn()
    except Exception as e:
        return f"<p> Error connecting to database</p>"

    return f"<p>Hello, {pg_conn.info.dbname}</p>"

if __name__ == '__main__':
    application.debug = True
    application.run()
