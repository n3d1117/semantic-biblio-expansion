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
        'biblio': str(r.header).split('<setSpec>')[1].split('</setSpec>')[0]
    }


def luogo_pubblicazione(r):
    xmldoc = minidom.parseString(r.raw)
    for el in xmldoc.getElementsByTagName('df'):
        if el.attributes['t'].value == '210':
            for sf in el.getElementsByTagName('sf'):
                if sf.attributes['c'].value == 'a':
                    luogo = sf.childNodes[0].nodeValue
                    luogo = luogo.replace("[", "").replace("]", "").replace(" etc.", "").replace(" V. P.", "").replace(" \etc.!", "")
                    if luogo not in ['S.l.', 'S. l.', 'S l.', 's.l.', 'A. 1', 'v.', 'Periodicità non determinata']:
                        return luogo.strip()
                    else:
                        return None
    return None


def get_coordinates(place):
    wikipedia.set_lang('it')
    try:
        coords = wikipedia.page(place).coordinates
        return str(coords[0]) + ',' + str(coords[1])
    except:
        return ''


def get_page_id(place):
    wikipedia.set_lang('it')
    try:
        return wikipedia.page(place).pageid
    except:
        return None


def delete_extra():
    db = database.get_db()
    # elimina record aventi luogo di pubblicazione fuori dalla toscana
    extr = ['36806', '1241244', '1010452', '2175049', '2318427', '2291823', '617150', '29082', '9028', '2588349',
            '20444', '2084359', '8463', '19209', '2508155', '2951758', '108073', '34590', '2986', '2490247', '2949307',
            '3467', '681231', '1291013', '28496', '3028', '1861131', '34448', '1141633', '17781', '660', '27675',
            '2495945', '24689', '19145', '2134654', '31720', '2538987', '28987', '4466']
    for e in extr:
        db.execute("DELETE FROM places WHERE id={}".format(e))
        db.execute("DELETE FROM records WHERE published_in={}".format(e))
        db.commit()


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

    db.execute('delete from biblios')
    db.execute('delete from records')
    db.execute('delete from places')
    db.execute("delete from sqlite_sequence where name='records'")

    query = "INSERT INTO records(title, subject, creator, contributor, date, description, language, publisher, type, format, relation, published_in, link, biblio)" \
            "VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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

                # Hardcoded coordinates
                if luogo == 'Accademia dei Georgofili':
                    coords = '43.7685119,11.255005'
                    place_id = '6569185'
                elif luogo == 'Massa':
                    coords = '44.033333,10.133333'
                    place_id = '875754'
                elif luogo == 'Castel S. Niccolò':
                    coords = '43.7192741,11.5975257'
                    place_id = '31541'
                elif luogo == 'Porcari':
                    coords = '43.8419546,10.6008321'
                    place_id = '32388'
                elif luogo == 'Cascina':
                    coords = '43.6877668,10.4729074'
                    place_id = '34342'
                elif luogo == 'San Vincenzo':
                    coords = '43.100134,10.540344'
                    place_id = '32495'
                elif luogo == 'Monte Oriolo, Impruneta':
                    coords = '43.70869,11.25515'
                    place_id = '18487140'

                if coords != '':
                    if place_id is None:
                        place_id = get_page_id(luogo)

                    if place_id is not None:
                        if not any(x[0] == place_id for x in places):
                            places.append((str(place_id), luogo, coords))

                        # Increment counters
                        count += 1
                        x += bit

                        d = record2dict(record, place_id)
                        array.append((d['title'].strip(), d['subject'], d['creator'], d['contributor'], d['date'],
                                      d['description'], d['language'], d['publisher'], d['type'], d['format'],
                                      d['relation'],  d['published_in'], d['link'], d['biblio']))
                    else:
                        print('could not find page id for ' + luogo + ', skipping...')
                else:
                    print('could not find coordinates for ' + luogo + ', skipping...')

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

