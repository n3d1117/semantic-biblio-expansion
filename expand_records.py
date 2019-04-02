from database import db as database
from lxml import etree
from extract_and_annotate_entities import *


def get_author_viaf_id(record):

    # escludi campi creator con nomi di città
    if record['creator'].startswith(('Pisa <', 'Livorno <', 'Prato <', 'Siena <', 'Lucca <', 'Firenze', 'Arezzo <')):
        return ''

    # .split(' <')[0] per fixare stringhe del tipo "Gurrieri, Francesco <1937- >"
    creator = record['creator'].split(' <')[0]
    if creator != '':
        re = requests.get('http://www.viaf.org/viaf/AutoSuggest?query={}'.format(creator))
        j = re.json()
        if j['result']:
            for result in j['result']:
                if result['nametype'] == 'personal':
                    return result['viafid']
    return ''


def get_author_wikipedia_info(record):
    try:
        wikipedia.set_lang('it')
        creator = record['creator'].split(' <')[0]
        if creator != '':
            summary = wikipedia.summary(creator, sentences=1)
            return summary
        return None
    except:
        return None


def get_author_wikipedia_page(viaf_id):
    response = requests.get('https://viaf.org/viaf/{}/viaf.xml'.format(viaf_id))
    tree = etree.fromstring(response.content)
    for link in tree.findall('.//ns1:xLink', tree.nsmap):
        if 'it.wikipedia.org' in link.text:
            return link.text
    return None


def get_opere(viaf_id):
    response = requests.get('https://viaf.org/viaf/{}/viaf.xml'.format(viaf_id))
    tree = etree.fromstring(response.content)
    opere = []
    for work in tree.findall('.//ns1:work', tree.nsmap):
        title = work.find('ns1:title', tree.nsmap).text
        opere.append(title)
        if len(opere) > 4:
            break
    return opere


def do_expand():

    x = 0

    print(' [*] connecting to database...')
    db = database.get_db()

    db.execute('delete from expanded_records')
    db.execute('delete from entities')
    db.execute('delete from entity_for_record')
    db.execute("delete from sqlite_sequence where name='expanded_records'")
    db.execute("delete from sqlite_sequence where name='entity_for_record'")

    print(' [*] requesting records via API...')
    r = requests.get('http://127.0.0.1:5000/api/v1/records')
    json = r.json()

    exp = []
    exp2 = []
    exp3 = []

    bit = 100 / len(json)

    query = "INSERT INTO expanded_records(id, viaf_id, author_other_works, author_wiki_page, author_wiki_info) VALUES(?, ?, ?, ?, ?)"
    query2 = "INSERT INTO entities(entity_id, title, abstract, image_url, coords, uri) VALUES(?, ?, ?, ?, ?, ?)"
    query3 = "INSERT INTO entity_for_record(record_id, entity_id) VALUES(?, ?)"

    for record in json:

        id = record['id']
        print(' [*] RECORD WITH ID {}'.format(id))

        viaf_id = get_author_viaf_id(record)
        altre_opere = ''
        wiki_page = ''
        wiki_info = ''

        if viaf_id != '':
            opere = get_opere(viaf_id)
            wiki = get_author_wikipedia_page(viaf_id)
            if len(opere) > 0:
                altre_opere = "~~".join(opere)
            if wiki is not None:
                wiki_page = wiki
                summary = get_author_wikipedia_info(record)
                if summary is not None:
                    wiki_info = summary

        exp.append((id, viaf_id, altre_opere, wiki_page, wiki_info))

        text_to_extract_from = clean(record['description']) + ', ' + record['subject'] + ', ' + \
                               author_cleanup(record['creator']) + ', ' + author_cleanup(record['contributor'])

        print(' [*] text: {}'.format(text_to_extract_from))

        entities = []#spacy_extract_entities(text_to_extract_from)
        print(' [*] received entities: {}'.format(entities))

        annotated_entities = query_wikipedia(entities)
        print(' [*] received annotated entities: {}'.format(annotated_entities))
        print()

        for entity in annotated_entities:
            if entity['coords'] != '':
                exp2.append((entity['id'], entity['title'], entity['abstract'], entity['image'], entity['coords'], entity['uri']))
                exp3.append((id, entity['id']))

        if id == len(json):
            yield "data: {}%%{}\n\n".format('100', 'done')
        else:
            x += bit
            desc = "Expanding record with id {}...".format(record['id'])
            yield "data: {}%%{}\n\n".format(str(x), desc)

    print(' [*] inserting expanded records to the table...')
    db.executemany(query, exp)

    print(' [*] inserting entities...')
    try:
        db.executemany(query2, exp2)
        db.executemany(query3, exp3)

        # elimina entità duplicate
        db.execute("DELETE FROM entities WHERE id NOT IN (SELECT MIN(id) FROM entities GROUP BY entity_id)")
        db.execute("DELETE FROM entity_for_record WHERE id NOT IN (SELECT MIN(id) FROM entity_for_record GROUP BY record_id, entity_id)")

        # elimina entità ambigue
        db.execute("DELETE FROM entities WHERE abstract=''")

        # elimina record aventi una sola entità associata, che coincide con il luogo di pubblicazione
        db.execute("DELETE FROM records WHERE id IN(SELECT e.record_id FROM entity_for_record e, records r, places p, entities en\
                    WHERE e.record_id = r.id AND r.published_in = p.id AND e.entity_id = en.entity_id\
                    GROUP BY e.record_id HAVING COUNT(*) = 1 AND en.title = p.name)")

        db.commit()
        print(' [*] done!')
    except Exception as e:
        print(e)
