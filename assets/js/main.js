"use strict";

document.addEventListener("DOMContentLoaded", initializeWebsite);

function initializeWebsite() {
    const WEATHER_REGION_CENTER = [50.34, 8.93];
    const INITIAL_ZOOM = 10;
    const FALLBACK_IMAGE = "./assets/images/placeholder.png";

    const mapElement = document.getElementById("map");
    const mapStatusElement = document.getElementById("mapStatus");
    const searchInput = document.getElementById("searchInput");
    const categoryFilter = document.getElementById("categoryFilter");
    const resetFiltersButton =
        document.getElementById("resetFilters");
    const resultsElement = document.getElementById("results");
    const resultCountElement =
        document.getElementById("resultCount");
    const currentYearElement =
        document.getElementById("currentYear");

    if (currentYearElement) {
        currentYearElement.textContent =
            new Date().getFullYear();
    }

    if (!mapElement) {
        console.error("Kartenelement #map nicht gefunden.");
        return;
    }

    if (typeof L === "undefined") {
        showMapError(
            "Die Kartenbibliothek konnte nicht geladen werden."
        );

        return;
    }

    /*
     * Leaflet-Karte initialisieren.
     */
    const map = L.map(mapElement, {
        center: WEATHER_REGION_CENTER,
        zoom: INITIAL_ZOOM,
        scrollWheelZoom: false,
        dragging: true,
        tap: false,
        touchZoom: true
    });

    /*
     * Eigene Ebene für die Grenze des Wetteraukreises.
     * Sie liegt über der Grundkarte, aber unter den Markern.
     */
    map.createPane("regionPane");

    const regionPane = map.getPane("regionPane");

    if (regionPane) {
        regionPane.style.zIndex = "350";
        regionPane.style.pointerEvents = "none";
    }

    /*
     * OpenStreetMap-Grundkarte.
     */
    const tileLayer = L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution:
                '&copy; <a ' +
                'href="https://www.openstreetmap.org/copyright" ' +
                'target="_blank" rel="noopener noreferrer">' +
                "OpenStreetMap-Mitwirkende</a>"
        }
    );

    tileLayer.on("load", hideMapStatus);

    tileLayer.on("tileerror", () => {
        showMapStatus(
            "Einige Kartenbereiche konnten nicht geladen werden."
        );
    });

    tileLayer.addTo(map);

    L.control.scale({
        imperial: false,
        metric: true
    }).addTo(map);

    let allLocations = [];

    const markerLayer = L.layerGroup().addTo(map);
    const activeMarkers = new Map();

    loadWetterauBoundary();
    loadLocations();

    window.setTimeout(() => {
        map.invalidateSize();
    }, 250);

    window.addEventListener("resize", () => {
        map.invalidateSize();
    });

    /*
     * Grenze des Wetteraukreises laden.
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
                console.warn(
                    "Wetteraukreis-Grenze nicht gefunden:",
                    response.status
                );

                return;
            }

            const boundaryData = await response.json();

            L.geoJSON(boundaryData, {
                pane: "regionPane",
                interactive: false,
                style: {
                    color: "#244a3a",
                    weight: 3,
                    opacity: 0.9,
                    fillColor: "#d3a449",
                    fillOpacity: 0.12,
                    lineCap: "round",
                    lineJoin: "round"
                }
            }).addTo(map);
        } catch (error) {
            console.warn(
                "Wetteraukreis-Grenze konnte nicht geladen werden:",
                error
            );
        }
    }

    /*
     * Ortsdaten laden.
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
                    `Fehler beim Laden der Orte: ${response.status}`
                );
            }

            const data = await response.json();

            if (!Array.isArray(data.features)) {
                throw new Error(
                    "Die GeoJSON-Datei enthält kein features-Array."
                );
            }

            allLocations = data.features.filter(
                isValidLocation
            );

            showLocations(allLocations, true);
        } catch (error) {
            console.error(
                "Ortsdaten konnten nicht geladen werden:",
                error
            );

            if (resultCountElement) {
                resultCountElement.textContent =
                    "Orte konnten nicht geladen werden.";
            }

            if (resultsElement) {
                resultsElement.replaceChildren(
                    createMessage(
                        "Beim Laden der Orte ist ein Fehler " +
                        "aufgetreten."
                    )
                );
            }
        }
    }

    /*
     * GeoJSON-Eintrag überprüfen.
     */
    function isValidLocation(location) {
        const coordinates =
            location?.geometry?.coordinates;

        return (
            location?.geometry?.type === "Point" &&
            Array.isArray(coordinates) &&
            coordinates.length >= 2 &&
            Number.isFinite(coordinates[0]) &&
            Number.isFinite(coordinates[1]) &&
            Boolean(location?.properties?.id) &&
            Boolean(location?.properties?.name)
        );
    }

    /*
     * Orte als Marker und Ergebnis-Karten anzeigen.
     */
    function showLocations(
        locations,
        adjustMap = false
    ) {
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
                        "Keine passenden Orte gefunden. " +
                        "Bitte ändere die Suche oder setze " +
                        "die Filter zurück."
                    )
                );
            }

            return;
        }

        const bounds = [];

        const isTouchDevice =
            "ontouchstart" in window ||
            navigator.maxTouchPoints > 0;

        locations.forEach((location) => {
            const properties = location.properties;
            const [longitude, latitude] =
                location.geometry.coordinates;
            const latitudeLongitude = [
                latitude,
                longitude
            ];

            const marker = L.marker(
                latitudeLongitude,
                {
                    icon: createMarkerIcon(
                        properties.category
                    ),
                    title: properties.name,
                    riseOnHover: true
                }
            );

            /*
             * Großes Popup beim Anklicken.
             */
            marker.bindPopup(
                createPopup(location),
                {
                    maxWidth: 310,
                    minWidth: 250,
                    autoPan: true,
                    autoPanPadding: [30, 30],
                    closeButton: true,
                    offset: [0, -18]
                }
            );

            /*
             * Hover-Vorschau nur auf Desktop-Geräten.
             */
            if (!isTouchDevice) {
                marker.bindTooltip(
                    createLocationPreview(location),
                    {
                        direction: "top",
                        offset: [0, -22],
                        opacity: 1,
                        className:
                            "location-preview-tooltip",
                        interactive: false,
                        sticky: false
                    }
                );

                marker.on("click", function closePreview() {
                    this.closeTooltip();
                });
            }

            marker.addTo(markerLayer);

            activeMarkers.set(
                properties.id,
                marker
            );

            bounds.push(latitudeLongitude);

            if (resultsElement) {
                resultsElement.appendChild(
                    createResultCard(location)
                );
            }
        });

        if (adjustMap && bounds.length > 1) {
            map.fitBounds(bounds, {
                padding: [40, 40],
                maxZoom: 11
            });
        } else if (
            adjustMap &&
            bounds.length === 1
        ) {
            map.setView(bounds[0], 13);
        }

        window.setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }

    /*
     * Emoji-Marker erstellen.
     */
    function createMarkerIcon(category) {
        const markerData =
            getCategoryData(category);

        return L.divIcon({
            className: "weather-marker-wrapper",
            html:
                `<div class="emoji-marker ` +
                `${markerData.className}">` +
                `<span aria-hidden="true">` +
                `${markerData.icon}` +
                `</span>` +
                `</div>`,
            iconSize: [46, 46],
            iconAnchor: [23, 23],
            popupAnchor: [0, -23],
            tooltipAnchor: [0, -23]
        });
    }

    /*
     * Kategorie, Emoji und Markerfarbe bestimmen.
     */
    function getCategoryData(category) {
        const categories = {
            "Burg und Schloss": {
                icon: "🏰",
                className: "marker-castle"
            },
            Natur: {
                icon: "🌳",
                className: "marker-nature"
            },
            Aussichtspunkt: {
                icon: "🌄",
                className: "marker-viewpoint"
            },
            Geschichte: {
                icon: "🏺",
                className: "marker-history"
            },
            "Stadt und Fachwerk": {
                icon: "🏘️",
                className: "marker-town"
            },
            Genuss: {
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
     * Wiederverwendbare Bildfehler-Behandlung.
     */
    function setFallbackImage(image) {
        image.addEventListener(
            "error",
            () => {
                if (
                    !image.src.endsWith(
                        "placeholder.png"
                    )
                ) {
                    image.src = FALLBACK_IMAGE;
                }
            },
            {
                once: true
            }
        );
    }

    /*
     * Tags als Liste erstellen.
     *
     * Diese Funktion muss direkt in initializeWebsite()
     * stehen und darf nicht innerhalb einer anderen
     * Funktion verschachtelt sein.
     */
    function createTagsList(
        tags,
        className = "location-tags",
        limit = 8
    ) {
        const list =
            document.createElement("ul");

        list.className = className;

        if (!Array.isArray(tags)) {
            return list;
        }

        tags
            .filter((tag) => {
                return (
                    typeof tag === "string" &&
                    tag.trim().length > 0
                );
            })
            .slice(0, limit)
            .forEach((tag) => {
                const item =
                    document.createElement("li");

                const normalizedTag = tag
                    .trim()
                    .replace(/\s+/g, "");

                item.textContent =
                    `#${normalizedTag}`;

                list.appendChild(item);
            });

        return list;
    }

    /*
     * Medienhinweise für die Hover-Vorschau.
     *
     * Die Badges sind keine Links, weil der Tooltip
     * beim Verlassen des Markers geschlossen wird.
     */
    function createAvailableMediaBadges(
        properties
    ) {
        const container =
            document.createElement("div");

        container.className =
            "marker-hover-media";

        if (
            isUsableUrl(
                properties.instagram_url
            )
        ) {
            const instagram =
                document.createElement("span");

            instagram.textContent =
                "📸 Instagram";

            container.appendChild(instagram);
        }

        if (
            isUsableUrl(
                properties.youtube_url
            )
        ) {
            const youtube =
                document.createElement("span");

            youtube.textContent =
                "▶️ YouTube";

            container.appendChild(youtube);
        }

        if (
            isUsableUrl(
                properties.website_url
            )
        ) {
            const website =
                document.createElement("span");

            website.textContent = "🔗 Infos";

            container.appendChild(website);
        }

        return container;
    }

    /*
     * Hover-Vorschau erstellen.
     */
    function createLocationPreview(location) {
        const properties = location.properties;
        const markerData = getCategoryData(
            properties.category
        );

        const preview =
            document.createElement("article");

        preview.className =
            "marker-hover-card";

        const image =
            document.createElement("img");

        image.src =
            properties.image ||
            FALLBACK_IMAGE;
        image.alt = "";
        image.loading = "lazy";

        setFallbackImage(image);

        const body =
            document.createElement("div");

        body.className =
            "marker-hover-body";

        const category =
            document.createElement("span");

        category.className =
            "marker-hover-cat";

        category.textContent =
            `${markerData.icon} ` +
            `${properties.category || "Ausflugsziel"}`;

        const title =
            document.createElement("strong");

        title.textContent =
            properties.name || "";

        const municipality =
            document.createElement("small");

        municipality.textContent = [
            properties.municipality,
            properties.area
        ]
            .filter(Boolean)
            .join(" · ");

        body.append(
            category,
            title,
            municipality
        );

        const descriptionText =
            properties.short_description ||
            properties.description ||
            "";

        if (descriptionText) {
            const description =
                document.createElement("p");

            description.textContent =
                descriptionText;

            body.appendChild(description);
        }

        const tags = createTagsList(
            properties.tags,
            "marker-hover-tags",
            4
        );

        if (tags.children.length > 0) {
            body.appendChild(tags);
        }

        const availableMedia =
            createAvailableMediaBadges(
                properties
            );

        if (
            availableMedia.children.length > 0
        ) {
            body.appendChild(availableMedia);
        }

        const hint =
            document.createElement("span");

        hint.className =
            "marker-hover-hint";

        hint.textContent =
            "Klicken für Details und Links";

        body.appendChild(hint);
        preview.append(image, body);

        return preview;
    }

    /*
     * Großes Karten-Popup erstellen.
     */
    function createPopup(location) {
        const properties = location.properties;
        const markerData = getCategoryData(
            properties.category
        );

        const popup =
            document.createElement("article");

        popup.className = "map-popup";

        const image =
            document.createElement("img");

        image.className = "map-popup-image";
        image.src =
            properties.image ||
            FALLBACK_IMAGE;
        image.alt =
            properties.image_alt ||
            properties.name;
        image.loading = "lazy";

        setFallbackImage(image);

        const category =
            document.createElement("p");

        category.className =
            "popup-category";

        category.textContent =
            `${markerData.icon} ` +
            `${properties.category || "Ausflugsziel"}`;

        const title =
            document.createElement("h3");

        title.textContent = properties.name;

        const locationText =
            document.createElement("p");

        locationText.className =
            "popup-location";

        locationText.textContent = [
            properties.municipality,
            properties.area
        ]
            .filter(Boolean)
            .join(" · ");

        const description =
            document.createElement("p");

        description.className =
            "popup-description";

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

        const facts =
            createPopupFacts(properties);

        if (facts.children.length > 0) {
            popup.appendChild(facts);
        }

        const tags = createTagsList(
            properties.tags,
            "popup-tags",
            6
        );

        if (tags.children.length > 0) {
            popup.appendChild(tags);
        }

        const links =
            createPopupLinks(properties);

        if (links.children.length > 0) {
            popup.appendChild(links);
        }

        return popup;
    }

    /*
     * Fakten im Karten-Popup.
     */
    function createPopupFacts(properties) {
        const list =
            document.createElement("ul");

        list.className = "popup-facts";

        const facts =
            getLocationFacts(properties);

        facts.forEach((fact) => {
            const item =
                document.createElement("li");

            item.textContent = fact;
            list.appendChild(item);
        });

        return list;
    }

    /*
     * Social- und Weblinks im Popup.
     */
    function createPopupLinks(properties) {
        const links =
            document.createElement("div");

        links.className =
            "popup-social-links";

        if (
            isUsableUrl(
                properties.instagram_url
            )
        ) {
            links.appendChild(
                createPopupLink(
                    properties.instagram_url,
                    "📸",
                    "Instagram",
                    "popup-instagram-link"
                )
            );
        }

        if (
            isUsableUrl(
                properties.youtube_url
            )
        ) {
            links.appendChild(
                createPopupLink(
                    properties.youtube_url,
                    "▶️",
                    "YouTube",
                    "popup-youtube-link"
                )
            );
        }

        if (
            isUsableUrl(
                properties.website_url
            )
        ) {
            links.appendChild(
                createPopupLink(
                    properties.website_url,
                    "🔗",
                    "Informationen",
                    "popup-website-link"
                )
            );
        }

        return links;
    }

    /*
     * Einzelnen Link im Popup erstellen.
     */
    function createPopupLink(
        url,
        iconText,
        labelText,
        additionalClass = ""
    ) {
        const link =
            document.createElement("a");

        link.className = [
            "popup-social-link",
            additionalClass
        ]
            .filter(Boolean)
            .join(" ");

        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";

        link.setAttribute(
            "aria-label",
            `${labelText} in einem neuen Tab öffnen`
        );

        const icon =
            document.createElement("span");

        icon.setAttribute(
            "aria-hidden",
            "true"
        );

        icon.textContent = iconText;

        const label =
            document.createElement("span");

        label.textContent = labelText;

        link.append(icon, label);

        return link;
    }

    /*
     * Ergebnis-Karte unterhalb der Karte erstellen.
     */
    function createResultCard(location) {
        const properties = location.properties;
        const markerData = getCategoryData(
            properties.category
        );

        const card =
            document.createElement("article");

        card.className = "result-card";
        card.dataset.locationId =
            properties.id;

        const image =
            document.createElement("img");

        image.className =
            "result-card-image";

        image.src =
            properties.image ||
            FALLBACK_IMAGE;

        image.alt =
            properties.image_alt ||
            properties.name;

        image.loading = "lazy";

        setFallbackImage(image);

        const content =
            document.createElement("div");

        content.className =
            "result-card-content";

        const category =
            document.createElement("p");

        category.className =
            "result-card-category";

        category.textContent =
            `${markerData.icon} ` +
            `${properties.category || "Ausflugsziel"}`;

        const title =
            document.createElement("h3");

        title.textContent = properties.name;

        const locationText =
            document.createElement("p");

        locationText.className =
            "result-card-location";

        locationText.textContent = [
            properties.municipality,
            properties.area
        ]
            .filter(Boolean)
            .join(" · ");

        const description =
            document.createElement("p");

        description.className =
            "result-card-description";

        description.textContent =
            properties.description ||
            properties.short_description ||
            "";

        const facts =
            createFactsList(properties);

        const tags = createTagsList(
            properties.tags,
            "result-card-tags",
            8
        );

        const actions =
            createCardActions(location);

        content.append(
            category,
            title,
            locationText,
            description
        );

        if (facts.children.length > 0) {
            content.appendChild(facts);
        }

        if (tags.children.length > 0) {
            content.appendChild(tags);
        }

        content.appendChild(actions);
        card.append(image, content);

        return card;
    }

    /*
     * Faktenliste für Ergebnis-Karten.
     */
    function createFactsList(properties) {
        const list =
            document.createElement("ul");

        list.className =
            "result-card-facts";

        const facts =
            getLocationFacts(properties);

        facts.forEach((fact) => {
            const item =
                document.createElement("li");

            item.textContent = fact;
            list.appendChild(item);
        });

        return list;
    }

    /*
     * Fakten zentral zusammenstellen.
     */
    function getLocationFacts(properties) {
        const facts = [];

        if (properties.visit_time) {
            facts.push(
                `⏱ ${properties.visit_time}`
            );
        }

        if (properties.parking === true) {
            facts.push("🚗 Parkplatz");
        }

        if (
            properties.family_friendly === true
        ) {
            facts.push("👨‍👩‍👧 Familie");
        }

        if (properties.accessible === true) {
            facts.push("♿ Barrierearm");
        }

        if (properties.best_season) {
            facts.push(
                `🍂 ${properties.best_season}`
            );
        }

        return facts;
    }

    /*
     * Buttons in einer Ergebnis-Karte.
     *
     * Die URLs werden unabhängig voneinander geprüft.
     * Deshalb können Instagram, YouTube und Website
     * gleichzeitig angezeigt werden.
     */
    function createCardActions(location) {
        const properties = location.properties;

        const actions =
            document.createElement("div");

        actions.className =
            "result-card-actions";

        const mapButton =
            document.createElement("button");

        mapButton.className =
            "card-map-button";

        mapButton.type = "button";
        mapButton.textContent =
            "📍 Auf Karte zeigen";

        mapButton.addEventListener(
            "click",
            () => {
                showLocationOnMap(location);
            }
        );

        actions.appendChild(mapButton);

        if (
            isUsableUrl(
                properties.instagram_url
            )
        ) {
            actions.appendChild(
                createExternalLink(
                    properties.instagram_url,
                    "Instagram",
                    "card-instagram-link"
                )
            );
        }

        if (
            isUsableUrl(
                properties.youtube_url
            )
        ) {
            actions.appendChild(
                createExternalLink(
                    properties.youtube_url,
                    "YouTube",
                    "card-youtube-link"
                )
            );
        }

        if (
            isUsableUrl(
                properties.website_url
            )
        ) {
            actions.appendChild(
                createExternalLink(
                    properties.website_url,
                    "Mehr erfahren",
                    "card-website-link"
                )
            );
        }

        return actions;
    }

    /*
     * Externen Link für Ergebnis-Karten erstellen.
     */
    function createExternalLink(
        url,
        platform,
        additionalClass = ""
    ) {
        const platformData = {
            Instagram: {
                icon: "📸",
                label: "Instagram"
            },
            YouTube: {
                icon: "▶️",
                label: "YouTube"
            },
            "Mehr erfahren": {
                icon: "🔗",
                label: "Mehr erfahren"
            }
        };

        const data =
            platformData[platform] || {
                icon: "🔗",
                label: platform
            };

        const link =
            document.createElement("a");

        link.className = [
            "card-external-link",
            additionalClass
        ]
            .filter(Boolean)
            .join(" ");

        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";

        link.setAttribute(
            "aria-label",
            `${data.label} zu diesem Ort ` +
            "in einem neuen Tab öffnen"
        );

        const icon =
            document.createElement("span");

        icon.setAttribute(
            "aria-hidden",
            "true"
        );

        icon.textContent = data.icon;

        const label =
            document.createElement("span");

        label.textContent = data.label;

        link.append(icon, label);

        return link;
    }

    /*
     * Aus Ergebnis-Karte zur Karte springen.
     */
    function showLocationOnMap(location) {
        const [longitude, latitude] =
            location.geometry.coordinates;

        const marker = activeMarkers.get(
            location.properties.id
        );

        const mapSection =
            document.getElementById("karte");

        if (mapSection) {
            mapSection.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }

        window.setTimeout(() => {
            map.invalidateSize();

            map.setView(
                [latitude, longitude],
                14,
                {
                    animate: true
                }
            );

            if (marker) {
                marker.openPopup();
            }
        }, 300);
    }

    /*
     * Suche und Kategorie-Filter.
     */
    function filterLocations() {
        const searchValue = normalizeText(
            searchInput
                ? searchInput.value
                : ""
        );

        const selectedCategory =
            categoryFilter
                ? categoryFilter.value
                : "all";

        const filteredLocations =
            allLocations.filter((location) => {
                const properties =
                    location.properties;

                const tags =
                    Array.isArray(properties.tags)
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

                const matchesSearch =
                    normalizeText(
                        searchableContent
                    ).includes(searchValue);

                const matchesCategory =
                    selectedCategory === "all" ||
                    properties.category ===
                        selectedCategory;

                return (
                    matchesSearch &&
                    matchesCategory
                );
            });

        showLocations(
            filteredLocations,
            false
        );
    }

    /*
     * Suchtext normalisieren.
     */
    function normalizeText(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase("de")
            .trim();
    }

    /*
     * Anzahl gefundener Orte aktualisieren.
     */
    function updateResultCount(count) {
        if (!resultCountElement) {
            return;
        }

        resultCountElement.textContent =
            count === 1
                ? "1 Ort gefunden"
                : `${count} Orte gefunden`;
    }

    /*
     * Allgemeine Meldung erstellen.
     */
    function createMessage(text) {
        const message =
            document.createElement("p");

        message.className =
            "empty-results";

        message.textContent = text;

        return message;
    }

    /*
     * Prüfen, ob eine URL verwendbar ist.
     */
    function isUsableUrl(value) {
        if (
            typeof value !== "string" ||
            !value.trim()
        ) {
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
     * Kartenstatus anzeigen.
     */
    function showMapStatus(message) {
        if (!mapStatusElement) {
            return;
        }

        mapStatusElement.hidden = false;
        mapStatusElement.textContent =
            message;
    }

    /*
     * Kartenstatus ausblenden.
     */
    function hideMapStatus() {
        if (!mapStatusElement) {
            return;
        }

        mapStatusElement.hidden = true;
    }

    /*
     * Schwerwiegenden Kartenfehler anzeigen.
     */
    function showMapError(message) {
        if (mapElement) {
            mapElement.classList.add(
                "map-error"
            );

            mapElement.textContent = message;
        }

        hideMapStatus();

        if (resultCountElement) {
            resultCountElement.textContent =
                "Die Karte konnte nicht geladen werden.";
        }
    }

    /*
     * Event-Listener.
     */
    if (searchInput) {
        searchInput.addEventListener(
            "input",
            filterLocations
        );
    }

    if (categoryFilter) {
        categoryFilter.addEventListener(
            "change",
            filterLocations
        );
    }

    if (resetFiltersButton) {
        resetFiltersButton.addEventListener(
            "click",
            () => {
                if (searchInput) {
                    searchInput.value = "";
                }

                if (categoryFilter) {
                    categoryFilter.value = "all";
                }

                showLocations(
                    allLocations,
                    true
                );

                if (searchInput) {
                    searchInput.focus();
                }
            }
        );
    }
}
