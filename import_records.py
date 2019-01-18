from sickle import Sickle
from database import db as database


def record2dict(r):
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
        'link': 'https://web.e.toscana.it' + r.metadata['identifier'][0].split("http://localhost")[1],
    }


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

    db.execute('delete from records')
    db.execute("delete from sqlite_sequence where name='records'")

    query = "insert into records(title, subject, creator, contributor, date, description, language, publisher, type, format, relation, link)" \
            "VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"

    print(' [*] parsing first {} records...'.format(max_num))
    for record in records:
        if count < max_num:
            d = record2dict(record)
            array.append((d['title'].strip(), d['subject'], d['creator'], d['contributor'], d['date'], d['description'],
                          d['language'], d['publisher'], d['type'], d['format'], d['relation'], d['link']))
            count += 1

            x += bit

            desc = "Importing records... ({}/{})".format(count, max_num)
            yield "data: {}%%{}\n\n".format(str(x), desc)
        else:
            break

    print(' [*] inserting saved records to the table...')
    db.executemany(query, array)
    db.commit()

    print(' [*] done!')
