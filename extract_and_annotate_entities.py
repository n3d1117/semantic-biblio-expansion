import requests
import spacy
import wikipedia
from bs4 import BeautifulSoup

nlp = spacy.load('it')


def clean(text):
    return text.replace('*', '').replace('. - v. : ill.', '').replace('((', '').replace(' :', ':').replace('- /', '-') \
        .replace('A. 1, n. 1 ', '').replace('A. 1, n.1', '').replace(' : [s. n.]', '').replace('- . - v. ;', '') \
        .replace('ill ; ', '').replace('- . -', '').replace('[s. n.], ', '').replace('s.n., ', '') \
        .replace(' ; ', ' ').replace('- N. 0 ', '').replace('p.: ill. ', '').replace('A. 1, n. 0 ', '')


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
                return None
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
                return None
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


def spacy_extract_entities(text):
    doc = nlp(text)
    return set([e.text for e in doc.ents if len(e.text) > 2])


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

    # Attemp to fetch coordinates for non-places entities
    for entity in annotated_entities:
        if entity['coords'] == '':
            # persona (luogo di nascita)
            coords = get_birth_location_coords(entity['title'])
            if coords is not None:
                entity['coords'] = str(coords[0]) + ',' + str(coords[1])
            else:
                # sede legale / luogo di formazione
                coords = get_business_location_coords(entity['title'])
                if coords is not None:
                    entity['coords'] = str(coords[0]) + ',' + str(coords[1])
                else:
                    # estrai primo link geolocalizzato dal summary di wikipedia
                    coords = extract_first_geolink_from_wiki_summary(entity['title'])
                    if coords is not None:
                        entity['coords'] = str(coords[0]) + ',' + str(coords[1])
    return annotated_entities