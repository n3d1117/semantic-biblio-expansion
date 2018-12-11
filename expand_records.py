from database import db as database
import requests


def get_viaf_id(author):
    re = requests.get('http://www.viaf.org/viaf/AutoSuggest?query={}'.format(author))
    j = re.json()
    if j['result']:
        for result in j['result']:
            if result['nametype'] == 'personal':
                return result['viafid']
    return None


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

    query = "INSERT INTO expanded_records(id, viaf_id) VALUES(?, ?)"

    print(' [*] looking for VIAF ids...')
    for record in json:

        viaf_id = ''

        # .split(' <')[0] per fixare stringhe del tipo "Gurrieri, Francesco <1937- >"
        tmp1 = get_viaf_id(record['creator'].split(' <')[0])
        if tmp1:
            viaf_id = tmp1
        else:
            tmp2 = get_viaf_id(record['contributor'].split(' <')[0])
            if tmp2:
                viaf_id = tmp2

        exp.append((record['id'], viaf_id))

        x += bit
        desc = "Checking VIAF for record with id {}...".format(record['id'])
        yield "data: {}%%{}\n\n".format(str(x), desc)

    print(' [*] inserting expanded records to the table...')
    db.executemany(query, exp)
    db.commit()
