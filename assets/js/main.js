"use strict";

document.addEventListener("DOMContentLoaded", initializeWebsite);

function initializeWebsite() {
    /*
     * Grundlegende DOM-Elemente
     */
    const mapElement = document.getElementById("map");
    const mapStatusElement = document.getElementById("mapStatus");
    const searchInput = document.getElementById("searchInput");
    const categoryFilter = document.getElementById("categoryFilter");
    const resetFiltersButton = document.getElementById("resetFilters");
    const resultsElement = document.getElementById("results");
    const resultCountElement = document.getElementById("resultCount");
    const currentYearElement = document.getElementById("currentYear");

    if (currentYearElement) {
        currentYearElement.textContent = new Date().getFullYear();
    }

    if (!mapElement) {
        console.error(
            "Das Kartenelement mit der ID 'map' wurde nicht gefunden."
        );

        return;
    }

    if (typeof L === "undefined") {
        showMapError(
            "Die Kartenbibliothek konnte nicht geladen werden. " +
            "Bitte prüfe deine Internetverbindung."
        );

        return;
    }

    /*
     * Karte erstellen
     */
    const WEATHER_REGION_CENTER = [50.34, 8.93];
    const INITIAL_ZOOM = 10;

    const map = L.map(mapElement, {
        center: WEATHER_REGION_CENTER,
        zoom: INITIAL_ZOOM,
        scrollWheelZoom: false,
        zoomControl: true,
        attributionControl: true
    });

    /*
     * Eigene Kartenebene für die Wetteraukreis-Grenze.
     * Die Ebene liegt über der Grundkarte, aber unter den Markern.
     */
    map.createPane("regionPane");

    const regionPane = map.getPane("regionPane");

    if (regionPane) {
        regionPane.style.zIndex = "350";
        regionPane.style.pointerEvents = "none";
    }

    /*
     * OpenStreetMap-Grundkarte
     */
    const tileLayer = L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution:
                "&copy; " +
                '<a href="https://www.openstreetmap.org/copyright" ' +
                'target="_blank" rel="noopener noreferrer">' +
                "OpenStreetMap-Mitwirkende</a>"
        }
    );

    tileLayer.on("load", () => {
        hideMapStatus();
    });

    tileLayer.on("tileerror", () => {
        showMapStatus(
            "Einige Kartenteile konnten nicht geladen werden."
        );
    });

    tileLayer.addTo(map);

    L.control.scale({
        imperial: false,
        metric: true
    }).addTo(map);

    /*
     * Daten und Marker
     */
    let allLocations = [];
    const markerLayer = L.layerGroup().addTo(map);
    const activeMarkers = new Map();

    /*
     * GeoJSON-Dateien laden
     */
    loadWetterauBoundary();
    loadLocations();

    /*
     * Leaflet benötigt nach Größenänderungen manchmal eine
     * Neuberechnung der Kartenfläche.
     */
    window.setTimeout(() => {
        map.invalidateSize();
    }, 250);

    window.addEventListener("resize", () => {
        map.invalidateSize();
    });

    /*
     * Offene Hover-Vorschauen beim Verschieben der Karte schließen.
     */
    map.on("movestart zoomstart", () => {
        map.closeTooltip();
    });

    /*
     * Wetteraukreis-Grenze laden
     */
    async function loadWetterauBoundary() {
        try {
            const boundaryUrl = new URL(
                "./data/wetteraukreis.geojson",
                document.baseURI
            );

            const response = await fetch(boundaryUrl.href, {
                cache: "no-store"
            });

            if (!response.ok) {
                throw new Error(
                    "Wetteraukreis-Grenze konnte nicht geladen werden: " +
                    response.status
                );
            }

            const boundaryData = await response.json();

            L.geoJSON(boundaryData, {
                pane: "regionPane",
                interactive: false,
                style: {
                    color: "#244a3a",
                    weight: 4,
                    opacity: 0.95,
                    fillColor: "#d3a449",
                    fillOpacity: 0.14,
                    lineCap: "round",
                    lineJoin: "round"
                }
            }).addTo(map);
        } catch (error) {
            /*
             * Die Karte funktioniert auch ohne Regionsgrenze.
             */
            console.warn(
                "Die Wetteraukreis-Grenze konnte nicht angezeigt werden.",
                error
            );
        }
    }

    /*
     * Ortsdaten laden
     */
    async function loadLocations() {
        try {
            const locationsUrl = new URL(
                "./data/locations.geojson",
                document.baseURI
            );

            const response = await fetch(locationsUrl.href, {
                cache: "no-store"
            });

            if (!response.ok) {
                throw new Error(
                    "Ortsdaten konnten nicht geladen werden: " +
                    response.status
                );
            }

            const data = await response.json();

            if (!Array.isArray(data.features)) {
                throw new Error(
                    "Die GeoJSON-Datei enthält kein features-Array."
                );
            }

            allLocations = data.features.filter(isValidLocation);

            showLocations(allLocations, true);
        } catch (error) {
            console.error(error);

            if (resultCountElement) {
                resultCountElement.textContent =
                    "Die Orte konnten nicht geladen werden.";
            }

            if (resultsElement) {
                resultsElement.replaceChildren(
                    createMessage(
                        "Beim Laden der Ortsdaten ist ein Fehler " +
                        "aufgetreten. Prüfe die Datei " +
                        "data/locations.geojson."
                    )
                );
            }
        }
    }

    /*
     * Prüfen, ob ein GeoJSON-Ort vollständig genug ist.
     */
    function isValidLocation(location) {
        if (
            !location ||
            !location.geometry ||
            !location.properties
        ) {
            return false;
        }

        const coordinates = location.geometry.coordinates;

        return (
            location.geometry.type === "Point" &&
            Array.isArray(coordinates) &&
            coordinates.length >= 2 &&
            Number.isFinite(coordinates[0]) &&
            Number.isFinite(coordinates[1]) &&
            Boolean(location.properties.id) &&
            Boolean(location.properties.name)
        );
    }

    /*
     * Orte auf Karte und in Ergebnisliste anzeigen.
     */
    function showLocations(locations, adjustMap = false) {
        markerLayer.clearLayers();
        activeMarkers.clear();

        if (resultsElement) {
            resultsElement.replaceChildren();
        }

        updateResultCount(locations.length);

        if (locations.length === 0) {
            if (resultsElement) {
                resultsElement.appendChild(
                    createMessage(
                        "Für diese Suche wurden keine Orte gefunden. " +
                        "Versuche einen anderen Suchbegriff oder " +
                        "setze die Filter zurück."
                    )
                );
            }

            return;
        }

        const bounds = [];

        locations.forEach((location) => {
            const properties = location.properties;
            const coordinates = location.geometry.coordinates;

            /*
             * GeoJSON verwendet:
             * [Längengrad, Breitengrad]
             *
             * Leaflet verwendet:
             * [Breitengrad, Längengrad]
             */
            const longitude = coordinates[0];
            const latitude = coordinates[1];
            const latitudeLongitude = [latitude, longitude];

            const marker = L.marker(latitudeLongitude, {
                icon: createMarkerIcon(properties.category),
                title: properties.name,
                keyboard: true,
                riseOnHover: true,
                riseOffset: 1000
            });

            /*
             * Große Detailansicht beim Anklicken.
             */
            marker.bindPopup(createPopup(location), {
                maxWidth: 320,
                minWidth: 240,
                autoPan: true,
                keepInView: true,
                closeButton: true
            });

            /*
             * Kleine Ortsvorschau beim Hover.
             */
            marker.bindTooltip(createLocationPreview(location), {
                direction: "top",
                offset: [0, -27],
                opacity: 1,
                className: "location-preview-tooltip",
                interactive: false,
                sticky: false
            });

            marker.on("click", () => {
                marker.closeTooltip();
            });

            marker.on("popupopen", () => {
                marker.closeTooltip();
            });

            /*
             * Tastaturbedienung:
             * Beim Fokus wird die Vorschau geöffnet.
             */
            marker.on("add", () => {
                const markerElement = marker.getElement();

                if (!markerElement) {
                    return;
                }

                markerElement.setAttribute(
                    "aria-label",
                    properties.name
                );

                markerElement.addEventListener("focus", () => {
                    if (!marker.isPopupOpen()) {
                        marker.openTooltip();
                    }
                });

                markerElement.addEventListener("blur", () => {
                    marker.closeTooltip();
                });
            });

            marker.addTo(markerLayer);

            activeMarkers.set(properties.id, marker);
            bounds.push(latitudeLongitude);

            if (resultsElement) {
                resultsElement.appendChild(
                    createResultCard(location)
                );
            }
        });

        /*
         * Kartenausschnitt an sichtbare Orte anpassen.
         */
        if (adjustMap && bounds.length > 1) {
            map.fitBounds(bounds, {
                padding: [55, 55],
                maxZoom: 11
            });
        } else if (adjustMap && bounds.length === 1) {
            map.setView(bounds[0], 13);
        }

        window.setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }

    /*
     * Emoji-Marker erzeugen.
     */
    function createMarkerIcon(category) {
        const markerData = getCategoryData(category);

        return L.divIcon({
            className: "weather-marker-wrapper",
            html: `
                <div
                    class="emoji-marker ${markerData.className}"
                    aria-hidden="true"
                >
                    <span>${markerData.icon}</span>
                </div>
            `,
            iconSize: [52, 52],
            iconAnchor: [26, 26],
            popupAnchor: [0, -31],
            tooltipAnchor: [0, -23]
        });
    }

    /*
     * Kategorie, Emoji und Markerfarbe zuordnen.
     */
    function getCategoryData(category) {
        const categories = {
            "Burg und Schloss": {
                icon: "🏰",
                className: "marker-castle"
            },
            "Natur": {
                icon: "🌳",
                className: "marker-nature"
            },
            "Aussichtspunkt": {
                icon: "🌄",
                className: "marker-viewpoint"
            },
            "Geschichte": {
                icon: "🏺",
                className: "marker-history"
            },
            "Stadt und Fachwerk": {
                icon: "🏘️",
                className: "marker-town"
            },
            "Genuss": {
                icon: "🍎",
                className: "marker-food"
            },
            "Landesgartenschau 2027": {
                icon: "🌸",
                className: "marker-lgs"
            }
        };

        return categories[category] || {
            icon: "📍",
            className: "marker-default"
        };
    }

    /*
     * Kleine Hover-Vorschau erzeugen.
     */
    function createLocationPreview(location) {
        const properties = location.properties;
        const markerData = getCategoryData(properties.category);

        const preview = document.createElement("article");
        preview.className = "marker-preview-card";

        const image = document.createElement("img");
        image.className = "marker-preview-image";
        image.src =
            properties.image ||
            "./assets/images/placeholder.svg";
        image.alt = "";
        image.loading = "lazy";

        image.addEventListener("error", () => {
            image.onerror = null;
            image.src = "./assets/images/placeholder.svg";
        });

        const content = document.createElement("div");
        content.className = "marker-preview-content";

        const category = document.createElement("p");
        category.className = "marker-preview-category";
        category.textContent =
            `${markerData.icon} ` +
            `${properties.category || "Ausflugsziel"}`;

        const title = document.createElement("strong");
        title.className = "marker-preview-title";
        title.textContent = properties.name;

        const locationText = document.createElement("p");
        locationText.className = "marker-preview-location";
        locationText.textContent = [
            properties.municipality,
            properties.area
        ]
            .filter(Boolean)
            .join(" · ");

        const description = document.createElement("p");
        description.className = "marker-preview-description";
        description.textContent =
            properties.short_description ||
            properties.description ||
            "";

        const hint = document.createElement("span");
        hint.className = "marker-preview-hint";
        hint.textContent = "Anklicken für Details";

        content.append(
            category,
            title,
            locationText,
            description,
            hint
        );

        preview.append(image, content);

        return preview;
    }

    /*
     * Großes Leaflet-Popup erzeugen.
     */
    function createPopup(location) {
        const properties = location.properties;
        const markerData = getCategoryData(properties.category);

        const popup = document.createElement("article");
        popup.className = "map-popup";

        const image = document.createElement("img");
        image.className = "map-popup-image";
        image.src =
            properties.image ||
            "./assets/images/placeholder.svg";
        image.alt =
            properties.image_alt ||
            properties.name;
        image.loading = "lazy";

        image.addEventListener("error", () => {
            image.onerror = null;
            image.src = "./assets/images/placeholder.svg";
        });

        const category = document.createElement("p");
        category.className = "popup-category";
        category.textContent =
            `${markerData.icon} ` +
            `${properties.category || "Ausflugsziel"}`;

        const title = document.createElement("h3");
        title.textContent = properties.name;

        const locationText = document.createElement("p");
        locationText.className = "popup-location";
        locationText.textContent = [
            properties.municipality,
            properties.area
        ]
            .filter(Boolean)
            .join(" · ");

        const description = document.createElement("p");
        description.className = "popup-description";
        description.textContent =
            properties.short_description ||
            properties.description ||
            "";

        popup.append(
            image,
            category,
            title,
            locationText,
            description
        );

        const facts = createPopupFacts(properties);

        if (facts.children.length > 0) {
            popup.appendChild(facts);
        }

        if (isUsableUrl(properties.website_url)) {
            const link = document.createElement("a");

            link.className = "popup-button";
            link.href = properties.website_url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = "Weitere Informationen";

            popup.appendChild(link);
        }

        return popup;
    }

    /*
     * Fakten im Popup anzeigen.
     */
    function createPopupFacts(properties) {
        const list = document.createElement("ul");
        list.className = "popup-facts";

        const facts = [];

        if (properties.visit_time) {
            facts.push(`⏱ ${properties.visit_time}`);
        }

        if (properties.parking === true) {
            facts.push("🚗 Parkplatz");
        }

        if (properties.family_friendly === true) {
            facts.push("👨‍👩‍👧 Familiengeeignet");
        }

        if (properties.accessible === true) {
            facts.push("♿ Barrierearm");
        }

        facts.forEach((fact) => {
            const item = document.createElement("li");
            item.textContent = fact;
            list.appendChild(item);
        });

        return list;
    }

    /*
     * Ergebniskarte unterhalb der Karte erzeugen.
     */
    function createResultCard(location) {
        const properties = location.properties;
        const markerData = getCategoryData(properties.category);

        const card = document.createElement("article");
        card.className = "result-card";
        card.dataset.locationId = properties.id;

        const image = document.createElement("img");
        image.className = "result-card-image";
        image.src =
            properties.image ||
            "./assets/images/placeholder.svg";
        image.alt =
            properties.image_alt ||
            properties.name;
        image.loading = "lazy";

        image.addEventListener("error", () => {
            image.onerror = null;
            image.src = "./assets/images/placeholder.svg";
        });

        const content = document.createElement("div");
        content.className = "result-card-content";

        const category = document.createElement("p");
        category.className = "result-card-category";
        category.textContent =
            `${markerData.icon} ` +
            `${properties.category || "Ausflugsziel"}`;

        const title = document.createElement("h3");
        title.textContent = properties.name;

        const locationText = document.createElement("p");
        locationText.className = "result-card-location";
        locationText.textContent = [
            properties.municipality,
            properties.area
        ]
            .filter(Boolean)
            .join(" · ");

        const description = document.createElement("p");
        description.className = "result-card-description";
        description.textContent =
            properties.description ||
            properties.short_description ||
            "";

        const facts = createFactsList(properties);
        const actions = createCardActions(location);

        content.append(
            category,
            title,
            locationText,
            description
        );

        if (facts.children.length > 0) {
            content.appendChild(facts);
        }

        content.appendChild(actions);
        card.append(image, content);

        return card;
    }

    /*
     * Fakten für die Ergebniskarten.
     */
    function createFactsList(properties) {
        const list = document.createElement("ul");
        list.className = "result-card-facts";

        const facts = [];

        if (properties.visit_time) {
            facts.push(`⏱ ${properties.visit_time}`);
        }

        if (properties.parking === true) {
            facts.push("🚗 Parkplatz");
        }

        if (properties.family_friendly === true) {
            facts.push("👨‍👩‍👧 Familie");
        }

        if (properties.accessible === true) {
            facts.push("♿ Barrierearm");
        }

        facts.forEach((fact) => {
            const item = document.createElement("li");
            item.textContent = fact;
            list.appendChild(item);
        });

        return list;
    }

    /*
     * Schaltflächen der Ergebniskarten.
     */
    function createCardActions(location) {
        const properties = location.properties;
        const actions = document.createElement("div");

        actions.className = "result-card-actions";

        const mapButton = document.createElement("button");

        mapButton.className = "card-map-button";
        mapButton.type = "button";
        mapButton.textContent = "Auf Karte zeigen";

        mapButton.addEventListener("click", () => {
            showLocationOnMap(location);
        });

        actions.appendChild(mapButton);

        if (isUsableUrl(properties.youtube_url)) {
            actions.appendChild(
                createExternalLink(
                    properties.youtube_url,
                    "YouTube"
                )
            );
        } else if (isUsableUrl(properties.instagram_url)) {
            actions.appendChild(
                createExternalLink(
                    properties.instagram_url,
                    "Instagram"
                )
            );
        } else if (isUsableUrl(properties.website_url)) {
            actions.appendChild(
                createExternalLink(
                    properties.website_url,
                    "Mehr erfahren"
                )
            );
        }

        return actions;
    }

    function createExternalLink(url, text) {
        const link = document.createElement("a");

        link.className = "card-external-link";
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = text;

        return link;
    }

    /*
     * Ort aus der Ergebnisliste auf der Karte anzeigen.
     */
    function showLocationOnMap(location) {
        const coordinates = location.geometry.coordinates;
        const longitude = coordinates[0];
        const latitude = coordinates[1];
        const marker = activeMarkers.get(location.properties.id);
        const mapSection = document.getElementById("karte");

        if (mapSection) {
            mapSection.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }

        window.setTimeout(() => {
            map.invalidateSize();

            map.setView([latitude, longitude], 15, {
                animate: true
            });

            if (marker) {
                marker.closeTooltip();
                marker.openPopup();
            }
        }, 400);
    }

    /*
     * Orte durchsuchen und filtern.
     */
    function filterLocations() {
        const searchValue = normalizeText(
            searchInput ? searchInput.value : ""
        );

        const selectedCategory = categoryFilter
            ? categoryFilter.value
            : "all";

        const filteredLocations = allLocations.filter(
            (location) => {
                const properties = location.properties;

                const tags = Array.isArray(properties.tags)
                    ? properties.tags
                    : [];

                const searchableContent = [
                    properties.name,
                    properties.municipality,
                    properties.area,
                    properties.category,
                    properties.description,
                    properties.short_description,
                    properties.best_season,
                    ...tags
                ]
                    .filter(Boolean)
                    .join(" ");

                const matchesSearch = normalizeText(
                    searchableContent
                ).includes(searchValue);

                const matchesCategory =
                    selectedCategory === "all" ||
                    properties.category === selectedCategory;

                return matchesSearch && matchesCategory;
            }
        );

        showLocations(filteredLocations, false);
    }

    function normalizeText(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase("de")
            .trim();
    }

    function updateResultCount(count) {
        if (!resultCountElement) {
            return;
        }

        resultCountElement.textContent =
            count === 1
                ? "1 Ort gefunden"
                : `${count} Orte gefunden`;
    }

    function createMessage(text) {
        const message = document.createElement("p");

        message.className = "empty-results";
        message.textContent = text;

        return message;
    }

    function isUsableUrl(value) {
        if (!value) {
            return false;
        }

        try {
            const url = new URL(value);

            return (
                url.protocol === "https:" ||
                url.protocol === "http:"
            );
        } catch (error) {
            return false;
        }
    }

    /*
     * Kartenstatus
     */
    function showMapStatus(message) {
        if (!mapStatusElement) {
            return;
        }

        mapStatusElement.hidden = false;
        mapStatusElement.textContent = message;
    }

    function hideMapStatus() {
        if (!mapStatusElement) {
            return;
        }

        mapStatusElement.hidden = true;
    }

    function showMapError(message) {
        mapElement.classList.add("map-error");
        mapElement.textContent = message;

        hideMapStatus();

        if (resultCountElement) {
            resultCountElement.textContent =
                "Die Karte konnte nicht gestartet werden.";
        }
    }

    /*
     * Such- und Filterereignisse
     */
    if (searchInput) {
        searchInput.addEventListener("input", filterLocations);
    }

    if (categoryFilter) {
        categoryFilter.addEventListener(
            "change",
            filterLocations
        );
    }

    if (resetFiltersButton) {
        resetFiltersButton.addEventListener("click", () => {
            if (searchInput) {
                searchInput.value = "";
            }

            if (categoryFilter) {
                categoryFilter.value = "all";
            }

            showLocations(allLocations, true);

            if (searchInput) {
                searchInput.focus();
            }
        });
    }
}
