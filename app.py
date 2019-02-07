from flask import Flask, jsonify, render_template, send_file, Response, stream_with_context, request
from database import db
import import_records
import expand_records
from collections import Counter

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


@app.route('/categories')
def categories():
    return render_template('categories.html')


@app.route('/import')
def do_import():
    return send_file('templates/import_stream.html')


@app.route('/_import')
def _import():
    return Response(stream_with_context(import_records.do_import(750)), mimetype='text/event-stream')


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
                            en.entity_id, en.title, en.abstract, en.categories, en.uri\
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
                'entity_id': r['entity_id'], 'title': r['title'], 'abstract': r['abstract'], 'categories': r['categories'], 'uri': r['uri']
            })
        return jsonify(data)


@app.route('/api/v1/entities', methods=['GET'])
def get_entities():
    entities = db.query_db('SELECT * FROM entities')
    data = []
    for e in entities:
        data.append(e['title'])
    return jsonify(sorted(data))


@app.route('/api/v1/categories', methods=['GET'])
def get_categories():
    all_categories = db.query_db('SELECT e.id AS record_id, en.categories AS categories\
                                  FROM expanded_records AS e, entities AS en, entity_for_record AS ent\
                                  WHERE e.id = ent.record_id and ent.entity_id = en.entity_id\
                                  ORDER BY e.id')
    data = {}
    for cat in all_categories:
        id = cat['record_id']
        for ca in cat['categories'].split(', '):
            if (id not in data or ca not in data[id]) and ca != '':
                data.setdefault(id, []).append(ca)
    return jsonify(sorted(list(set(sum(data.values(), [])))))


@app.route('/api/v1/top_entities', methods=['GET'])
def get_top_entities():
    limit = int(request.args.get('limit'))
    top_entities = db.query_db('SELECT en.title, count(*) as count\
                                FROM  entity_for_record as e, entities as en\
                                WHERE e.entity_id = en.entity_id GROUP BY en.title ORDER BY count DESC LIMIT {}'.format(limit))
    result = {}
    for e in top_entities:

        # Unisci ad esempio 'Firenze' con 'Provincia di Firenze'
        if e['title'].startswith('Provincia di '):
            city = e['title'].split('Provincia di ')[1]
            if city in result:
                result[city] += e['count']
            else:
                result[city] = e['count']
        else:
            if e['title'] in result:
                result[e['title']] += e['count']
            else:
                result[e['title']] = e['count']
    return jsonify(result)


@app.route('/api/v1/top_categories', methods=['GET'])
def get_top_categories():
    limit = int(request.args.get('limit'))
    all_categories = db.query_db('SELECT e.id AS record_id, en.categories AS categories\
                                  FROM expanded_records AS e, entities AS en, entity_for_record AS ent\
                                  WHERE e.id = ent.record_id and ent.entity_id = en.entity_id\
                                  ORDER BY e.id')
    data = {}
    for cat in all_categories:
        id = cat['record_id']
        for ca in cat['categories'].split(', '):
            if (id not in data or ca not in data[id]) and ca != '':
                data.setdefault(id, []).append(ca)
    c = Counter(x for xs in data.values() for x in set(xs)).most_common(limit)
    result = {}
    for ca in c:
        if ca[0].startswith('Provincia di '):
            city = ca[0].split('Provincia di ')[1]
            if city in result:
                result[city] += ca[1]
            else:
                result[city] = ca[1]
        else:
            if ca[0] in result:
                result[ca[0]] += ca[1]
            else:
                result[ca[0]] = ca[1]
    return jsonify(result)


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
