from sickle import Sickle
from database import db as database
from xml.dom import minidom
import wikipedia


def record2dict(r, place_id):
    return {
        'title': r.metadata['title'][0] if 'title' in r.metadata else '',
        'subject': ', '.join(r.metadata['subject']) if 'subject' in r.metadata else '',
        'creator': r.metadata['creator'][0] if 'creator' in r.metadata else '',
        'contributor': r.metadata['contributor'][0] if 'contributor' in r.metadata else '',
        'date': r.metadata['date'][0] if 'date' in r.metadata else '',
        'description': r.metadata['description'][0] if 'description' in r.metadata else '',
        'language': r.metadata['language'][0] if 'language' in r.metadata else '',
        'publisher': r.metadata['publisher'][0] if 'publisher' in r.metadata else '',
        'type': ', '.join(r.metadata['type']) if 'type' in r.metadata else '',
        'format': r.metadata['format'][0] if 'format' in r.metadata else '',
        'relation': r.metadata['relation'][0] if 'relation' in r.metadata else '',
        'published_in': place_id if place_id is not None else '',
        'link': 'https://web.e.toscana.it' + r.metadata['identifier'][0].split("http://localhost")[1],
    }


def luogo_pubblicazione(r):
    xmldoc = minidom.parseString(r.raw)
    for el in xmldoc.getElementsByTagName('df'):
        if el.attributes['t'].value == '210':
            for sf in el.getElementsByTagName('sf'):
                if sf.attributes['c'].value == 'a':
                    luogo = sf.childNodes[0].nodeValue
                    luogo = luogo.replace("[", "").replace("]", "").replace(" etc.", "").replace(" V. P.", "")
                    if luogo not in ['S.l.', 'S. l.', 'A. 1', 'Periodicità non determinata']:
                        return luogo.strip()
                    else:
                        return None
    return None


def get_coordinates(place):
    wikipedia.set_lang('it')
    try:
        return wikipedia.page(place).coordinates
    except:
        return None


def get_page_id(place):
    wikipedia.set_lang('it')
    try:
        return wikipedia.page(place).pageid
    except:
        return None


def do_import(max_num):

    x = 0
    bit = 100 / max_num

    print(' [*] connecting to database...')
    db = database.get_db()

    print(' [*] connecting to the OAI-PMH server...')
    sickle = Sickle('https://web.e.toscana.it/SebinaOpac/OAIHandler')

    print(' [*] fetching records with prefix `oai_dc` (Dublin Core)...')
    records = sickle.ListRecords(metadataPrefix='oai_dc')

    count = 0
    array = []
    places = []

    db.execute('delete from records')
    db.execute('delete from places')
    db.execute("delete from sqlite_sequence where name='records'")

    query = "INSERT INTO records(title, subject, creator, contributor, date, description, language, publisher, type, format, relation, published_in, link)" \
            "VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    query2 = "INSERT INTO places(id, name, coords) VALUES(?, ?, ?)"

    print(' [*] parsing first {} records...'.format(max_num))
    for record in records:
        if count < max_num:

            # Estrai luogo di pubblicazione dallo stesso record ma in formato Unimarc
            unimarc = sickle.GetRecord(identifier=record.header.identifier, metadataPrefix='oai_unimarc')
            luogo = luogo_pubblicazione(unimarc)

            place_id = None

            if luogo is not None:
                coords = get_coordinates(luogo)
                if coords is not None and coords != '':
                    coords_stringified = str(coords[0]) + ',' + str(coords[1])
                    place_id = get_page_id(luogo)
                    if place_id is not None and not any(x[0] == place_id for x in places):
                        places.append((place_id, luogo, coords_stringified))

            d = record2dict(record, place_id)
            array.append((d['title'].strip(), d['subject'], d['creator'], d['contributor'], d['date'], d['description'],
                          d['language'], d['publisher'], d['type'], d['format'], d['relation'], d['published_in'], d['link']))

            count += 1

            x += bit
            desc = "Importing records... ({}/{})".format(count, max_num)
            yield "data: {}%%{}\n\n".format(str(x), desc)
        else:
            print(' [*] closing source...')
            yield "data: {}%%{}\n\n".format('100', 'done')
            break

    print(' [*] inserting saved records to the table...')
    db.executemany(query, array)
    db.executemany(query2, places)
    db.commit()

    print(' [*] done!')