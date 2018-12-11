from flask import Flask, jsonify, render_template
from database import db
import import_records
import expand_records

app = Flask(__name__)

# TODO: event stream


@app.teardown_appcontext
def close_connection(_):
    db.close_db()


@app.route('/records')
def test():
    return render_template('records.html')

@app.route('/')
def main_page():
    return render_template('index.html')


@app.route('/import')
def do_import():
    import_records.do_import(20)
    return 'done!'


@app.route('/expand')
def do_expand():
    expand_records.do_expand()
    return 'done!'


@app.route('/api/v1/records', methods=['GET'])
def get_records():
    records = db.query_db('SELECT * FROM records')
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
