from database import db as database
import requests
import wikipedia
from lxml import etree


def get_author_viaf_id(record):
    # .split(' <')[0] per fixare stringhe del tipo "Gurrieri, Francesco <1937- >"
    creator = record['creator'].split(' <')[0]
    if creator != '':
        re = requests.get('http://www.viaf.org/viaf/AutoSuggest?query={}'.format(creator))
        j = re.json()
        if j['result']:
            for result in j['result']:
                if result['nametype'] == 'personal':
                    return result['viafid']
    # todo check contributors too?
    return ''


def get_author_wikipedia_info(record):
    try:
        wikipedia.set_lang('it')
        creator = record['creator'].split(' <')[0]
        if creator != '':
            summary = wikipedia.summary(creator, sentences=1)
            # todo add page url
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


if __name__ == '__main__':
    # print(get_opere('49239963'))
    # print(get_author_wikipedia_info({'creator': 'giuseppe maschili'}))
    get_author_wikipedia_page('51736727')


def do_expand():

    x = 0

    print(' [*] connecting to database...')
    db = database.get_db()

    db.execute('delete from expanded_records')
    db.execute("delete from sqlite_sequence where name='expanded_records'")

    print(' [*] requesting records via API...')
    r = requests.get('http://127.0.0.1:5000/api/v1/records')
    json = r.json()
    exp = []

    bit = 100 / len(json)

    query = "INSERT INTO expanded_records(id, viaf_id, author_other_works, author_wiki_page, author_wiki_info) VALUES(?, ?, ?, ?, ?)"

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

        # todo use dandelion APIs to extract entities from 'description' field, and add those to schema as well

        # todo web page that shows most frequent categories, and the ability to set filters

        exp.append((id, viaf_id, altre_opere, wiki_page, wiki_info))

        x += bit
        desc = "Expanding record with id {}...".format(record['id'])
        yield "data: {}%%{}\n\n".format(str(x), desc)

    print(' [*] inserting expanded records to the table...')
    db.executemany(query, exp)
    db.commit()
