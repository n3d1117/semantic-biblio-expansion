from flask import Flask, jsonify, render_template, send_file, Response, stream_with_context, request
from database import db
import import_records
import expand_records
from collections import Counter

app = Flask(__name__)


@app.teardown_appcontext
def close_connection(_):
    db.close_db()


@app.route('/')
def main_page():
    return render_template('index.html')


@app.route('/records')
def records():
    return render_template('records.html')


@app.route('/map')
def map_page():
    return render_template('map.html')


@app.route('/import')
def do_import():
    return send_file('templates/import_stream.html')


@app.route('/_import')
def _import():
    init_db()
    return Response(stream_with_context(import_records.do_import(1000)), mimetype='text/event-stream')


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


@app.route('/api/v1/get_expanded_record', methods=['GET'])
def get_expanded_record():
    id = request.args.get('id')
    records = db.query_db("SELECT DISTINCT e.id AS record_id, e.viaf_id, e.author_other_works, e.author_wiki_page, e.author_wiki_info,\
                            en.entity_id, en.title, en.abstract, en.coords, en.image_url, en.uri\
                            FROM expanded_records as e, entities as en, entity_for_record as ent\
                            WHERE e.id = ent.record_id and en.entity_id = ent.entity_id and e.id = {}".format(id))

    # record senza entità
    if len(records) == 0:
        records = db.query_db("SELECT e.id AS record_id, e.viaf_id, e.author_other_works, e.author_wiki_page, e.author_wiki_info\
                               FROM expanded_records as e WHERE e.id = {}".format(id))
        data = {
            'id': records[0]['record_id'],
            'viaf_id': records[0]['viaf_id'],
            'author_wiki_info': records[0]['author_wiki_info'],
            'author_wiki_page': records[0]['author_wiki_page'],
            'author_other_works': records[0]['author_other_works'],
            'entities': ''
        }
        return jsonify(data)

    else:
        data = {
            'id': records[0]['record_id'],
            'viaf_id': records[0]['viaf_id'],
            'author_wiki_info': records[0]['author_wiki_info'],
            'author_wiki_page': records[0]['author_wiki_page'],
            'author_other_works': records[0]['author_other_works'],
            'entities': []
        }
        for r in records:
            data['entities'].append({
                'entity_id': r['entity_id'], 'title': r['title'], 'abstract': r['abstract'], 'image': r['image_url'],
                'coords': r['coords'], 'uri': r['uri']
            })
        return jsonify(data)


@app.route('/api/v1/get_entities_for_record', methods=['GET'])
def get_entities_for_record():
    entities = db.query_db('SELECT e.id AS record_id, en.title\
                            FROM expanded_records AS e, entities AS en, entity_for_record AS ent\
                            WHERE e.id = ent.record_id and ent.entity_id = en.entity_id\
                            ORDER BY e.id')
    result = {}
    for e in entities:
        if e['title'] != '':
            result.setdefault(e['record_id'], []).append(e['title'])
    return jsonify(result)


@app.route('/api/v1/places', methods=['GET'])
def get_places():
    places = db.query_db('SELECT * FROM places')
    return jsonify(places)


@app.route('/api/v1/records_for_place', methods=['GET'])
def get_records_for_place():
    place_id = request.args.get('place_id')
    places = db.query_db('SELECT r.id, r.title FROM records r, places p WHERE r.published_in = p.id and p.id = {}'.format(place_id))
    return jsonify(places)


@app.route('/api/v1/geo_entities_for_record', methods=['GET'])
def get_geo_entities_for_record():
    record_id = request.args.get('record_id')
    geo_entities = db.query_db('SELECT en.entity_id, en.title, en.coords FROM entity_for_record e, entities en\
                                WHERE e.entity_id = en.entity_id AND en.coords != "" AND e.record_id = {}'.format(record_id))
    return jsonify(geo_entities)


@app.route('/api/v1/entity', methods=['GET'])
def get_entity():
    entity_id = request.args.get('entity_id')
    entity = db.query_db('SELECT * FROM entities WHERE entity_id = {}'.format(entity_id))
    return jsonify(entity)


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
