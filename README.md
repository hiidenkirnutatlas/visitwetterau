# Wetterau nach Feierabend

Ein persönliches Creator-Projekt über besondere Orte, Natur, Geschichte
und kleine Ausflüge in der Wetterau.

Instagram und später YouTube bilden die eigentlichen
Erzählplattformen. Die Website ergänzt diese Inhalte mit einer
interaktiven Karte, Bildern, praktischen Informationen und Links zu den
jeweiligen Beiträgen.

## Website

Die aktuelle Website ist über GitHub Pages erreichbar:

[Wetterau nach Feierabend](https://hiidenkirnutatlas.github.io/visitwetterau/)

Als spätere eigene Domain ist vorgesehen:

```text
wetterau-nach-feierabend.info
```

Die Domain ist derzeit noch nicht mit der Website verbunden.

## Instagram

Aktuelle Reels, Bilder und Eindrücke aus der Wetterau erscheinen auf
Instagram:

[Wetterau nach Feierabend auf Instagram](https://www.instagram.com/wetterau_nach_feierabend/)

## Über das Projekt

Im Mittelpunkt stehen Ausflüge, die sich auch nach einem Arbeitstag
unternehmen lassen.

Dazu gehören beispielsweise:

- Burgen und Schlösser
- Natur und Naturschutzgebiete
- Seen und Auenlandschaften
- Aussichtspunkte
- Fachwerkstädte und historische Orte
- Kelten, Römer und mittelalterliche Geschichte
- regionale Besonderheiten
- Orte der Landesgartenschau Oberhessen 2027
- Ziele im angrenzenden Oberhessen und Rhein-Main-Gebiet

Die Karte wächst mit jedem besuchten Ort. Neue Einträge erhalten nach
Möglichkeit eigene Bilder, geprüfte Besuchsinformationen und Links zu
passenden Beiträgen auf Instagram oder YouTube.

## Funktionen

Die Website bietet derzeit:

- interaktive Karte auf Basis von Leaflet
- Kartenmaterial von OpenStreetMap
- hervorgehobene Grenze des Wetteraukreises
- Emoji-Marker für unterschiedliche Kategorien
- Suche nach Orten, Gemeinden, Beschreibungen und Tags
- Filter nach Kategorien
- Vorschaukarten beim Überfahren eines Markers
- Detail-Popups beim Anklicken eines Markers
- Verlinkungen zu Instagram, YouTube und Informationsseiten
- Ergebnis-Karten unterhalb der interaktiven Karte
- Hero-Video mit statischem Fallback-Bild
- responsive Darstellung für Desktop, Tablet und Smartphone
- Impressum und Datenschutzerklärung

## Projektstruktur

```text
visitwetterau/
├── .nojekyll
├── README.md
├── index.html
├── impressum.html
├── datenschutz.html
├── assets/
│   ├── css/
│   │   ├── style.css
│   │   └── legal.css
│   ├── images/
│   │   ├── hero.jpg
│   │   ├── hero.png
│   │   ├── placeholder.png
│   │   ├── wetterau_1920_compressed.mp4
│   │   └── locations/
│   │       ├── bergwerksee-reichelsheim.png
│   │       └── beobachtungsturm_ludwigsquelle_karben.jpg
│   └── js/
│       └── main.js
└── data/
    ├── locations.geojson
    └── wetteraukreis.geojson
```

## Ortsdaten bearbeiten

Alle auf der Karte dargestellten Orte befinden sich in:

```text
data/locations.geojson
```

Die Datei verwendet das GeoJSON-Format. Jeder Ort wird als einzelnes
`Feature` mit einer Punktgeometrie angelegt.

Beispiel:

```json
{
    "type": "Feature",
    "properties": {
        "id": "BEI001",
        "slug": "beispielort",
        "name": "Beispielort",
        "municipality": "Beispielgemeinde",
        "area": "Wetterau",
        "category": "Natur",
        "short_description": "Kurze Beschreibung des Ortes.",
        "description": "Ausführlichere Beschreibung des Ortes.",
        "visit_time": "1 Stunde",
        "parking": false,
        "family_friendly": true,
        "accessible": false,
        "best_season": "Ganzjährig",
        "image": "assets/images/locations/beispielort.jpg",
        "image_alt": "Beschreibung des Bildes",
        "instagram_url": "",
        "youtube_url": "",
        "website_url": "",
        "source_url": "",
        "verified": false,
        "tags": [
            "Natur",
            "Wetterau"
        ]
    },
    "geometry": {
        "type": "Point",
        "coordinates": [
            8.93,
            50.34
        ]
    }
}
```

## Koordinaten

GeoJSON verwendet die Koordinatenreihenfolge:

```text
[Längengrad, Breitengrad]
```

Beispiel:

```json
"coordinates": [
    8.8448,
    50.3497
]
```

Die Werte dürfen nicht vertauscht werden.

## Kategorien

Die Website unterstützt derzeit folgende Kategorien:

```text
Burg und Schloss
Natur
Aussichtspunkt
Geschichte
Stadt und Fachwerk
Genuss
Landesgartenschau 2027
```

Die Kategorie im GeoJSON muss exakt mit der Bezeichnung in
`assets/js/main.js` und im Filter der `index.html` übereinstimmen.

## Bilder hinzufügen

Ortsbilder werden im folgenden Verzeichnis gespeichert:

```text
assets/images/locations/
```

Der Bildpfad wird anschließend beim jeweiligen Ort eingetragen:

```json
"image": "assets/images/locations/beispielort.jpg"
```

Empfehlungen:

- nur eigene oder passend lizenzierte Bilder verwenden
- Bilder vor dem Hochladen komprimieren
- Dateinamen kleinschreiben
- keine Leerzeichen in Dateinamen verwenden
- Wörter mit Bindestrichen oder Unterstrichen trennen
- einen aussagekräftigen Alternativtext eintragen

Beispiel:

```json
"image_alt": "Blick über den Bergwerksee bei Reichelsheim"
```

## Instagram und YouTube verknüpfen

Ein Instagram-Beitrag kann direkt mit einem Ort verknüpft werden:

```json
"instagram_url": "https://www.instagram.com/reel/BEITRAGS_ID/"
```

Ein normales YouTube-Video wird so eingetragen:

```json
"youtube_url": "https://www.youtube.com/watch?v=VIDEO_ID"
```

Ein YouTube-Short kann ebenfalls verlinkt werden:

```json
"youtube_url": "https://www.youtube.com/shorts/SHORT_ID"
```

Wenn zu einem Ort noch kein Beitrag existiert, bleibt das entsprechende
Feld leer:

```json
"instagram_url": "",
"youtube_url": ""
```

Das JavaScript zeigt nur Links an, deren URL-Feld tatsächlich gefüllt
ist. Instagram, YouTube und die Informationsseite können gleichzeitig
angezeigt werden.

## Tags

Tags verbessern die Suche und werden in Ortskarten, Popups und
Hover-Vorschauen dargestellt.

Beispiel:

```json
"tags": [
    "Bergwerksee",
    "Braunkohle",
    "Wetterauer Seenplatte",
    "Streuobstwiesen"
]
```

Tags sollten kurz, sachlich und für den jeweiligen Ort relevant sein.

## Eigenschaften eines Ortes

Einige Angaben werden als `true` oder `false` gespeichert:

```json
"parking": false,
"family_friendly": true,
"accessible": false,
"verified": true
```

Bedeutung:

- `parking`: Eine reguläre Parkmöglichkeit wurde bestätigt.
- `family_friendly`: Der Ort eignet sich grundsätzlich für einen Besuch
  mit Kindern.
- `accessible`: Der Ort oder der relevante Zugang ist barrierearm.
- `verified`: Die Informationen wurden durch einen persönlichen Besuch
  oder anhand einer zuverlässigen Quelle geprüft.

Unsichere Angaben sollten nicht vorschnell auf `true` gesetzt werden.

## Grenze des Wetteraukreises

Die hervorgehobene Grenze des Wetteraukreises befindet sich in:

```text
data/wetteraukreis.geojson
```

Sie wird in `assets/js/main.js` als eigene Leaflet-Ebene geladen und
unterhalb der Ortsmarker dargestellt.

Die markierte Fläche zeigt den Wetteraukreis als Verwaltungsgebiet. Die
historische beziehungsweise naturräumliche Wetterau kann davon
abweichen.

## Hero-Video

Das Hintergrundvideo des Hero-Bereichs befindet sich unter:

```text
assets/images/wetterau_1920_compressed.mp4
```

Das Fallback- und Posterbild befindet sich unter:

```text
assets/images/hero.jpg
```

Das Video sollte:

- im MP4-Format vorliegen
- möglichst mit H.264 codiert sein
- keinen notwendigen Ton enthalten
- kurz und für das Web komprimiert sein
- wichtige Motive möglichst in der Bildmitte zeigen

Die Darstellung verwendet:

```css
object-fit: cover;
```

Dadurch füllt das Video den Hero-Bereich vollständig aus. Abhängig vom
Seitenverhältnis des Bildschirms können Teile an den Rändern
abgeschnitten werden.

Bei aktivierter Einstellung für reduzierte Bewegung wird das Video
ausgeblendet und das Fallback-Bild angezeigt.

## Datenschutz

Die Website verwendet derzeit:

- keine eigene Reichweitenmessung
- keine Werbenetzwerke
- keine Nutzerkonten
- keine Analyse-Cookies
- keine eingebetteten Instagram- oder YouTube-Player

Technische Ressourcen werden derzeit unter anderem von folgenden
Diensten geladen:

- GitHub Pages
- jsDelivr
- OpenStreetMap

Weitere Informationen befinden sich in:

```text
datenschutz.html
```

## Impressum

Die Anbieterkennzeichnung befindet sich in:

```text
impressum.html
```

Vor einer öffentlichen Veröffentlichung müssen dort sämtliche
Platzhalter durch korrekte Angaben ersetzt werden.

Dazu gehören insbesondere:

```text
VORNAME NACHNAME
STRASSE UND HAUSNUMMER
POSTLEITZAHL ORT
DEINE-EMAIL@BEISPIEL.DE
```

## Lokale Vorschau

Da die Website GeoJSON-Dateien über `fetch()` lädt, sollte die
`index.html` nicht direkt als lokale Datei geöffnet werden.

Stattdessen kann ein lokaler Webserver gestartet werden.

Mit Python:

```bash
python -m http.server 8000
```

Die Website ist anschließend unter dieser Adresse erreichbar:

```text
http://localhost:8000/
```

Alternativ kann beispielsweise die Erweiterung „Live Server“ in Visual
Studio Code verwendet werden.

## GitHub Pages

Die Website wird über GitHub Pages bereitgestellt.

Konfiguration:

1. Repository auf GitHub öffnen.
2. `Settings` auswählen.
3. `Pages` öffnen.
4. Unter `Build and deployment` die Option
   `Deploy from a branch` auswählen.
5. Branch `main` auswählen.
6. Verzeichnis `/root` auswählen.
7. Einstellungen speichern.

Die aktuelle Adresse lautet:

```text
https://hiidenkirnutatlas.github.io/visitwetterau/
```

## Eigene Domain

Als spätere Domain ist vorgesehen:

```text
wetterau-nach-feierabend.info
```

Nach dem Domainkauf kann sie unter
`Settings` → `Pages` → `Custom domain` eingetragen werden.

GitHub verwendet dafür eine Datei namens:

```text
CNAME
```

Ihr Inhalt lautet anschließend:

```text
wetterau-nach-feierabend.info
```

Nach erfolgreicher DNS-Prüfung sollte `Enforce HTTPS` aktiviert werden.

Solange die eigene Domain nicht verbunden ist, sollten Canonical- und
Open-Graph-Adressen in `index.html` auf die aktuelle GitHub-Pages-Adresse
verweisen.

## Browser-Cache bei Änderungen

Nach Änderungen an CSS oder JavaScript kann in `index.html` ein
Versionsparameter erhöht werden:

```html
<link
    rel="stylesheet"
    href="./assets/css/style.css?v=8"
>

<script src="./assets/js/main.js?v=8"></script>
```

Dadurch laden Browser die aktuelle Datei statt einer älteren Version aus
dem Cache.

## Prüfung vor einem neuen Karteneintrag

Vor der Veröffentlichung eines Ortes sollten insbesondere geprüft
werden:

- korrekte Koordinaten
- öffentliche Zugänglichkeit
- aktuelle Öffnungszeiten
- mögliche Eintrittspreise
- Parkmöglichkeiten
- Wegzustand
- Barrierearmut
- aktuelle Beschilderung
- Schutzgebietsregeln
- Foto- und Drohnenregeln
- korrekte Quellen
- Nutzungsrechte der Bilder

Bei Natur- und Schutzgebieten haben die örtlichen Schutzbestimmungen
Vorrang. Wegegebote, Betretungsverbote und Drohnenverbote müssen
beachtet werden.

## Unabhängigkeit

Wetterau nach Feierabend ist ein unabhängiges, privat betriebenes
Creator-Projekt.

Es besteht keine Verbindung zum Wetteraukreis oder zur TourismusRegion
Wetterau GmbH.

Die Auswahl der Orte und die veröffentlichten Einschätzungen beruhen
auf persönlichen Besuchen und eigenen Erfahrungen. Offizielle
Informationen der jeweiligen Betreiber und Kommunen sollten vor einem
Besuch zusätzlich geprüft werden.

## Technische Grundlagen

Die Website verwendet:

- HTML
- CSS
- JavaScript
- Leaflet
- GeoJSON
- OpenStreetMap
- GitHub Pages

Es ist kein Build-System und kein JavaScript-Framework erforderlich.
