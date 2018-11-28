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
    }


# https://stackoverflow.com/a/44089843/6022481
def split_sql_expressions(text):
    results = []
    current = ''
    state = None
    for c in text:
        if state is None:  # default state, outside of special entity
            current += c
            if c in '"\'':
                # quoted string
                state = c
            elif c == '-':
                # probably "--" comment
                state = '-'
            elif c == '/':
                # probably '/*' comment
                state = '/'
            elif c == ';':
                # remove it from the statement
                current = current[:-1].strip()
                # and save current stmt unless empty
                if current:
                    results.append(current)
                current = ''
        elif state == '-':
            if c != '-':
                # not a comment
                state = None
                current += c
                continue
            # remove first minus
            current = current[:-1]
            # comment until end of line
            state = '--'
        elif state == '--':
            if c == '\n':
                # end of comment
                # and we do include this newline
                current += c
                state = None
            # else just ignore
        elif state == '/':
            if c != '*':
                state = None
                current += c
                continue
            # remove starting slash
            current = current[:-1]
            # multiline comment
            state = '/*'
        elif state == '/*':
            if c == '*':
                # probably end of comment
                state = '/**'
        elif state == '/**':
            if c == '/':
                state = None
            else:
                # not an end
                state = '/*'
        elif state[0] in '"\'':
            current += c
            if state.endswith('\\'):
                # prev was backslash, don't check for ender
                # just revert to regular state
                state = state[0]
                continue
            elif c == '\\':
                # don't check next char
                state += '\\'
                continue
            elif c == state[0]:
                # end of quoted string
                state = None
        else:
            raise Exception('Illegal state %s' % state)

    if current:
        current = current.rstrip(';').strip()
        if current:
            results.append(current)

    return results
