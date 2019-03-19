import requests
import spacy
import wikipedia
from bs4 import BeautifulSoup

nlp = spacy.load('it')


def author_cleanup(author):
    if '<' in author:
        author = author.split(' <')[0]
    if ',' in author:
        s = author.split(', ')
        author = s[1] + ' ' + s[0]
    return author


def clean(text):
    return text.replace('*', '').replace('. - v. : ill.', '').replace('((', '').replace(' :', ':').replace('- /', '-') \
        .replace('A. 1, n. 1 ', '').replace('A. 1, n.1', '').replace(' : [s. n.]', '').replace('- . - v. ;', '') \
        .replace('ill ; ', '').replace('- . -', '').replace('[s. n.], ', '').replace('s.n., ', '') \
        .replace(' ; ', ' ').replace('- N. 0 ', '').replace('p.: ill. ', '').replace('A. 1, n. 0 ', '')


def get_birth_location_coords(person):
    url = 'https://query.wikidata.org/sparql'
    query = """
    SELECT DISTINCT ?item ?birthLocation ?birthLocationLabel ?coordinates WHERE {
        ?item rdfs:label "%s"@it.
        ?item wdt:P19 ?birthLocation.
        ?birthLocation wdt:P625 ?coordinates.
        SERVICE wikibase:label { bd:serviceParam wikibase:language "it". }
    }
    """ % person
    r = requests.get(url, params={'format': 'json', 'query': query})
    data = r.json()
    if 'results' in data and 'bindings' in data['results']:
        for item in data['results']['bindings']:
            if 'coordinates' in item and 'value' in item['coordinates']:
                return item['coordinates']['value']
    return None


def get_business_location_coords(org):
    url = 'https://query.wikidata.org/sparql'
    query = """
    SELECT DISTINCT ?item ?place ?placeLabel ?coordinates WHERE {
        ?item rdfs:label "%s"@it. 
        ?item wdt:P159 ?place.
        ?place wdt:P625 ?coordinates.
        SERVICE wikibase:label { bd:serviceParam wikibase:language "it". }
    }
    """ % org
    r = requests.get(url, params={'format': 'json', 'query': query})
    data = r.json()
    if 'results' in data and 'bindings' in data['results']:
        for item in data['results']['bindings']:
            if 'coordinates' in item and 'value' in item['coordinates']:
                return item['coordinates']['value']
    return None


def extract_first_geolink_from_wiki_summary(query):
    wikipedia.set_lang('it')
    try:
        full_html = wikipedia.page(query).html()
        summary = full_html.split('<p>')[1].split('</p>')[0]
        soup = BeautifulSoup(summary, "html.parser")
        links = soup.find_all('a', href=True)
    except:
        return None
    for a in links:
        try:
            c = wikipedia.page(a['title']).coordinates
            return c
        except:
            continue
    return None


def spacy_extract_entities(text):
    doc = nlp(text)
    return set([e.text for e in doc.ents if len(e.text) > 2 and not e.text.replace('.', '', 1).isdigit()])


def query_wikipedia(entities):
    wiki_url = 'https://it.wikipedia.org/w/api.php'
    params = {
        'format': 'json',
        'formatversion': 2,
        'action': 'query',
        'prop': 'extracts|pageimages|coordinates',
        'piprop': 'thumbnail',
        'pithumbsize': 300,
        'pilicense': 'any',
        'exsentences': 2,
        'exsectionformat': 'plain',
        'explaintext': '',
        'exlimit': 20,
        'exintro': '',
        'redirects': 1,
        'titles': '|'.join(entities)
    }
    r = requests.get(wiki_url, params=params)
    json = r.json()
    annotated_entities = []
    if 'query' in json and 'pages' in json['query']:
        for page in json['query']['pages']:
            if 'pageid' in page:
                annotated_entities.append({
                    'id': str(page['pageid']),
                    'title': page['title'],
                    'abstract': page['extract'],
                    'uri': 'https://it.wikipedia.org/?curid={}'.format(page['pageid']),
                    'image': page['thumbnail']['source'] if 'thumbnail' in page and 'source' in page['thumbnail'] else '',
                    'coords': str(page['coordinates'][0]['lat']) + ',' + str(page['coordinates'][0]['lon']) if 'coordinates' in page else ''
                })
    return fetch_missing_coords(annotated_entities)


# Attemp to fetch coordinates for non-places entities
def fetch_missing_coords(annotated_entities):
    for entity in annotated_entities:

        if entity['coords'] == '':

            # Hardcoded coords
            if entity['title'] == 'Diocesi di Prato':
                entity['coords'] = '43.880814,11.096561'
            elif entity['title'] == 'Diocesi di Fiesole':
                entity['coords'] = '43.8,11.3'
            elif entity['title'] == 'Diocesi di Pescia':
                entity['coords'] = '43.9,10.683333'
            elif entity['title'] == 'Diocesi di Pistoia':
                entity['coords'] = '43.933333,10.916667'
            elif entity['title'] == 'Mario Luzi':
                entity['coords'] = '43.833333,11.2'
            elif entity['title'] == 'Basilica di San Lorenzo':
                entity['coords'] = '43.774889,11.253864'
            else:
                # persona (luogo di nascita)
                coords = get_birth_location_coords(entity['title'])
                if coords is not None:
                    entity['coords'] = coords.split(' ')[1].split(')')[0] + ',' + coords.split(' ')[0].split('(')[1]
                else:
                    # sede legale / luogo di formazione
                    coords = get_business_location_coords(entity['title'])
                    if coords is not None:
                        entity['coords'] = coords.split(' ')[1].split(')')[0] + ',' + coords.split(' ')[0].split('(')[1]
                    else:
                        # ultimo tentativo
                        # estrai primo link geolocalizzato dal summary di wikipedia
                        coords = extract_first_geolink_from_wiki_summary(entity['title'])
                        if coords is not None:
                            entity['coords'] = str(coords[0]) + ',' + str(coords[1])
    return annotated_entities
