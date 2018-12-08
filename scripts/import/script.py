from sickle import Sickle
import mysql.connector
from mysql.connector import Error
from utils import split_sql_expressions, record2dict


def main():
    db_name = 'records_db'
    config = {'user': 'root', 'password': 'root', 'unix_socket': '/Applications/MAMP/tmp/mysql/mysql.sock'}

    try:
        print(' [*] connecting to mysql configuration...')
        db = mysql.connector.connect(**config)
        cursor = db.cursor()

        print(' [*] creating database `{}` if it doesn\'t exist...'.format(db_name))
        cursor.execute("create database IF NOT EXISTS {}".format(db_name))
        cursor.execute("USE {}".format(db_name))

        print(' [*] executing `records.sql` file...')
        with open('./records.sql', 'r') as file:
            for s in split_sql_expressions(file.read()):
                cursor.execute(s)

        print(' [*] deleting all rows from table `records` and resetting auto increment...')
        cursor.execute("DELETE FROM records".format(db_name))
        cursor.execute("ALTER TABLE records AUTO_INCREMENT = 1")

        print(' [*] connecting to the OAI-PMH server...')
        sickle = Sickle('https://web.e.toscana.it/SebinaOpac/OAIHandler')

        print(' [*] fetching records with prefix `oai_dc` (Dublin Core)...')
        records = sickle.ListRecords(metadataPrefix='oai_dc')

        count = 0
        array = []

        query = "INSERT INTO records(title, subject, creator, contributor, date, description, language, publisher, type, format, relation, link)" \
                "VALUES(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"

        print(' [*] parsing first 1000 records...')
        for record in records:
            if count < 1000:

                d = record2dict(record)
                array.append((d['title'].strip(), d['subject'], d['creator'], d['contributor'], d['date'], d['description'],
                              d['language'], d['publisher'], d['type'], d['format'], d['relation'], d['link']))

                count += 1
            else:
                break

        print(' [*] inserting saved records to the table...')
        cursor.executemany(query, array)
        db.commit()

    except Error as e:
        print(' [*] Oops! Caught an exception: ', e.msg)

    finally:
        cursor.close()
        db.close()
        print(' [*] all done! Check out http://localhost:8888/phpMyAdmin/sql.php?db=records_db&table=records')


if __name__ == '__main__':
    main()
