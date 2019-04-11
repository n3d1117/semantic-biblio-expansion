# Semantic expansion of bibliographic records
A visualization paradigm based on geolocated data. [See online demo here!](https://semantic-biblio-expansion.herokuapp.com/map)

<p align="center">
  <img src="https://i.imgur.com/K0Gyom6.jpg">
</p>

## What's this?
This is the project I made for my CS thesis. In short:
- Pulls and parses bibliographic data from an [OAI-PMH](https://it.wikipedia.org/wiki/Open_Archives_Initiative_Protocol_for_Metadata_Harvesting) based endpoint ([here](https://web.e.toscana.it/SebinaOpac/OAIHandler))
- Uses entity extraction tasks ([spaCy](https://spacy.io)) based on ML to generate semantic links
- Adds Wikipedia annotations and Wikidata SPARQL queries to enrich data
- Displays results in a web application based on a dynamic interactive map ([Leaflet](https://leafletjs.com))

## Prerequisites
- [Python 3](https://www.python.org/downloads/) installed (tested on v3.6)

## Requirements
- lxml, beautifulsoup4, wikipedia, sickle, flask, spacy
- Spacy's italian statistical model (`python -m spacy download it_core_web_sm`), see more [here](https://spacy.io/models)

## How to run
Run `FLASK_APP=app.py flask run` to launch the Web Server and visit `localhost:5000`
