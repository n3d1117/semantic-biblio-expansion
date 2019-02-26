from database import db as database
import wikipedia
from lxml import etree
from import_records import get_coordinates
import requests
from bs4 import BeautifulSoup


def dandelion_extract_entities(text):
    token = 'xxx'
    response = requests.get('https://api.dandelion.eu/datatxt/nex/v1/?lang=it&min_confidence=0.7&token={}&text={}&include=abstract,image'.format(token, text))
    return response.json()


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
    return opere


def get_birth_location_coords(person):
    wikipedia.set_lang('it')
    url = 'https://query.wikidata.org/sparql'
    query = """
    SELECT DISTINCT ?item ?birthLocation ?birthLocationLabel WHERE {
        ?item rdfs:label "%s"@it; wdt:P19 ?birthLocation
        SERVICE wikibase:label { bd:serviceParam wikibase:language "it". }
    }
    """ % person
    r = requests.get(url, params={'format': 'json', 'query': query})
    data = r.json()
    if 'results' in data and 'bindings' in data['results']:
        for item in data['results']['bindings']:
            try:
                c = wikipedia.page(item['birthLocationLabel']['value']).coordinates
                return c
            except:
                continue
    else:
        return None


def get_business_location_coords(org):
    wikipedia.set_lang('it')
    url = 'https://query.wikidata.org/sparql'
    query = """
    SELECT DISTINCT ?item ?place ?placeLabel WHERE {
        ?item rdfs:label "%s"@it; wdt:P159 ?place
        SERVICE wikibase:label { bd:serviceParam wikibase:language "it". }
    }
    """ % org
    r = requests.get(url, params={'format': 'json', 'query': query})
    data = r.json()
    if 'results' in data and 'bindings' in data['results']:
        for item in data['results']['bindings']:
            try:
                c = wikipedia.page(item['placeLabel']['value']).coordinates
                return c
            except:
                continue
    else:
        return None


def extract_first_geolink_from_wiki_summary(query):
    wikipedia.set_lang('it')
    try:
        full_html = wikipedia.page(query).html()
    except:
        return None
    summary = full_html.split('<p>')[1].split('</p>')[0]
    soup = BeautifulSoup(summary, "html.parser")
    links = soup.find_all('a', href=True)
    for a in links:
        try:
            c = wikipedia.page(a['title']).coordinates
            return c
        except:
            continue
    return None


if __name__ == '__main__':
    # print(get_opere('49239963'))
    # print(get_author_wikipedia_info({'creator': 'giuseppe maschili'}))
    # print(get_author_viaf_id({'creator': 'Pisa <Provincia>'}))
    # get_author_wikipedia_page('51736727')
    # j = dandelion_extract_entities("giuseppe")
    # wikipedia.set_lang('it')
    # print(wikipedia.page('Valdinievole').links)
    # print(get_birth_location_coords('Società Italiana Ernesto Breda per Costruzioni Meccaniche'))
    # import geocoder
    # g = geocoder.osm('Valdinievole')
    # print(g.latlng)
    print(get_birth_location_coords('Iris Origo'))
    print(get_business_location_coords('Banca Monte dei Paschi di Siena'))
    print(extract_first_geolink_from_wiki_summary('Valdinievole'))


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

        text_to_extract_from = record['description'] + ' ' + record['subject']
        entities = dandelion_extract_entities(text_to_extract_from)
        if 'annotations' in entities:
            for a in entities['annotations']:
                coords_stringified = ''

                # Coordinates

                # luogo
                coords = get_coordinates(a['title'])
                if coords is not None:
                    coords_stringified = str(coords[0]) + ',' + str(coords[1])
                else:
                    # persona (data di nascita)
                    coords = get_birth_location_coords(a['title'])
                    if coords is not None:
                        coords_stringified = str(coords[0]) + ',' + str(coords[1])
                    else:
                        # sede legale / luogo di formazione
                        coords = get_business_location_coords(a['title'])
                        if coords is not None:
                            coords_stringified = str(coords[0]) + ',' + str(coords[1])
                        else:
                            # estrai primo link geolocalizzato dal summary di wikipedia
                            coords = extract_first_geolink_from_wiki_summary(a['title'])
                            if coords is not None:
                                coords_stringified = str(coords[0]) + ',' + str(coords[1])

                # Image
                image_full = ''
                if 'image' in a and 'thumbnail' in a['image']:
                    image_full = a['image']['thumbnail']

                # todo uncomment if
                # if coords_stringified != '':
                exp2.append((a['id'], a['title'], a['abstract'], image_full, coords_stringified, a['uri']))
                exp3.append((id, a['id']))
        else:
            print(' [*] hit dandelion daily limit!')

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

        db.commit()
        print(' [*] done!')
    except Exception as e:
        print(e)