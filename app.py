from flask import Flask, jsonify, render_template, send_file, Response, stream_with_context, request
from database import db
import import_records
import expand_records

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
    return Response(stream_with_context(import_records.do_import(2000)), mimetype='text/event-stream')


@app.route('/expand')
def do_expand():
    return send_file('templates/expand_stream.html')


@app.route('/_expand')
def _expand():
    return Response(stream_with_context(expand_records.do_expand()), mimetype='text/event-stream')


@app.route('/api/v1/records', methods=['GET'])
def get_records():
    records = db.query_db('SELECT r.*, p.name AS place FROM records r, places p WHERE r.published_in = p.id')
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


@app.route('/api/v1/search', methods=['GET'])
def search():
    query = request.args.get('q')
    exp = request.args.get('expansions') == 'true'

    response = []

    # search query in entities
    if exp:
        entities = db.query_db('SELECT * FROM entities WHERE title LIKE "{q} %" OR title LIKE "% {q}" OR title LIKE "% {q} %" OR title LIKE "{q}"'.format(q=query))
        for e in entities:
            if e['coords'] != '':
                response.append({
                    'type': 'entity',
                    'entity_id': e['entity_id'],
                    'coords': e['coords'],
                    'title': e['title'],
                    'abstract': e['abstract'],
                    'image_url': e['image_url'],
                    'uri': e['uri']
                })

    # search query in places
    places = db.query_db('SELECT * from places WHERE name LIKE "%{}%"'.format(query))
    for p in places:
        records = db.query_db('SELECT r.id AS record_id, r.title FROM records r, places p WHERE r.published_in = p.id AND p.id={}'.format(p['id']))
        if len(records) > 0:
            response.append({
                'type': 'place',
                'place_id': p['id'],
                'coords': p['coords'],
                'name': p['name'],
                'records': records
            })

    # search query in records
    records = db.query_db('SELECT id AS record_id, title, published_in from records WHERE title LIKE "%{q}%" OR subject LIKE "%{q}%" OR description LIKE "%{q}%" OR creator LIKE "%{q}%" OR contributor LIKE "%{q}%" OR publisher LIKE "%{q}%"'.format(q=query))

    records_places = []
    for r in records:
        if r['published_in'] != '' and r['published_in'] not in records_places:
            records_places.append(r['published_in'])

    for place in records_places:

        query_place = db.query_db('SELECT places.name, places.coords from places WHERE places.id={}'.format(place))

        p_records = [r for r in records if r['published_in'] == place]

        e_records = []
        for r in p_records:
            e_records.append({
                'record_id': r['record_id'],
                'title': r['title']
            })

        if len(query_place) > 0 and len(e_records) > 0:

            e = [r for r in response if 'place_id' in r and r['place_id'] == place]
            if len(e) > 0:
                # if place exists, append and remove duplicates
                e[0]['records'] = [dict(t) for t in {tuple(d.items()) for d in (e[0]['records'] + e_records)}]
            else:
                # or else just append
                response.append({
                    'type': 'place',
                    'place_id': place,
                    'coords': query_place[0]['coords'],
                    'name': query_place[0]['name'],
                    'records': e_records
                })

    return jsonify(response)


@app.route('/api/v1/geo_entities_for_record', methods=['GET'])
def get_geo_entities_for_record():
    record_id = request.args.get('record_id')
    geo_entities = db.query_db('SELECT en.* FROM entity_for_record e, entities en\
                                WHERE e.entity_id = en.entity_id AND en.coords != "" AND e.record_id = {}'.format(record_id))
    return jsonify(geo_entities)


@app.route('/api/v1/get_full_record', methods=['GET'])
def get_full_record():
    record_id = request.args.get('record_id')
    record = db.query_db('SELECT r.*, p.name as luogo_pubblicazione, e.* '
                         'FROM records r, expanded_records e, places p '
                         'WHERE e.id = r.id and r.published_in = p.id and r.id = {}'.format(record_id))
    result = {
        'id': record[0]['id'],
        'title': record[0]['title'],
        'subject': record[0]['subject'],
        'creator': record[0]['creator'],
        'contributor': record[0]['contributor'],
        'date': record[0]['date'],
        'description': record[0]['description'],
        'language': record[0]['language'],
        'publisher': record[0]['publisher'],
        'type': record[0]['type'],
        'format': record[0]['format'],
        'relation': record[0]['relation'],
        'published_in': record[0]['luogo_pubblicazione'],
        'link': record[0]['link'],
        'viaf_id': record[0]['viaf_id'],
        'author_other_works': record[0]['author_other_works'],
        'author_wiki_page': record[0]['author_wiki_page'],
        'author_wiki_info': record[0]['author_wiki_info'],
        'entities': []
    }
    entities = db.query_db('SELECT en.* FROM entity_for_record e, entities en '
                           'WHERE e.entity_id = en.entity_id and e.record_id = {}'.format(record_id))
    for e in entities:
        result['entities'].append({
            'id': e['entity_id'],
            'title': e['title'],
            'abstract': e['abstract'],
            'image_url': e['image_url'],
            'uri': e['uri'],
            'coords': e['coords']
        })
    return jsonify(result)


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
