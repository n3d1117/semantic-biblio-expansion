from flask import Flask, jsonify, render_template, send_file, Response, stream_with_context, request
from database import db
import import_records
import expand_records

app = Flask(__name__)

# TODO: navbar


@app.teardown_appcontext
def close_connection(_):
    db.close_db()


@app.route('/')
def main_page():
    return render_template('index.html')


@app.route('/records')
def records():
    return render_template('records.html')


@app.route('/import')
def do_import():
    return send_file('templates/import_stream.html')


@app.route('/_import')
def _import():
    return Response(stream_with_context(import_records.do_import(300)), mimetype='text/event-stream')


@app.route('/expand')
def do_expand():
    return send_file('templates/expand_stream.html')


@app.route('/_expand')
def _expand():
    return Response(stream_with_context(expand_records.do_expand()), mimetype='text/event-stream')


@app.route('/api/v1/records', methods=['GET'])
def get_records():
    records = db.query_db('SELECT * FROM records')
    return jsonify(records)


@app.route('/api/v1/expanded_records', methods=['GET'])
def get_expanded_records():
    records = db.query_db('SELECT * FROM expanded_records')
    return jsonify(records)


@app.route('/api/v1/get_expanded_record', methods=['GET'])
def get_expanded_record():
    id = request.args.get('id')
    records = db.query_db('SELECT * FROM expanded_records WHERE id = {}'.format(id))
    return jsonify(records)


@app.route('/init_db')
def init_db():
    with app.app_context():
        d = db.get_db()
        with app.open_resource('database/schema.sql', mode='r') as f:
            d.cursor().executescript(f.read())
        d.commit()
        return 'database initialized correctly!'


if __name__ == '__main__':
    app.run()
