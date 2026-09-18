"use strict";

document.addEventListener("DOMContentLoaded", initializeWebsite);

function initializeWebsite() {
    const mapElement = document.getElementById("map");
    const mapStatus = document.getElementById("mapStatus");
    const searchInput = document.getElementById("searchInput");
    const categoryFilter = document.getElementById("categoryFilter");
    const resetButton = document.getElementById("resetFilters");
    const resultsElement = document.getElementById("results");
    const resultCount = document.getElementById("resultCount");
    const currentYear = document.getElementById("currentYear");

    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }

    if (!mapElement) {
        console.error("Das Element mit der ID 'map' wurde nicht gefunden.");
        return;
    }

    if (typeof L === "undefined") {
        showMapError(
            "Leaflet konnte nicht geladen werden. " +
            "Bitte prüfe deine Internetverbindung."
        );

        return;
    }

    const map = L.map(mapElement, {
        center: [50.34, 8.93],
        zoom: 10,
        scrollWheelZoom: false
    });

    const tileLayer = L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution:
                "&copy; OpenStreetMap-Mitwirkende"
        }
    );

    tileLayer.on("load", () => {
        if (mapStatus) {
            mapStatus.hidden = true;
        }
    });

    tileLayer.on("tileerror", () => {
        if (mapStatus) {
            mapStatus.hidden = false;
            mapStatus.textContent =
                "Einige Kartenteile konnten nicht geladen werden.";
        }
    });

    tileLayer.addTo(map);

    L.control.scale({
        imperial: false,
        metric: true
    }).addTo(map);

    let allLocations = [];
    let markerLayer = L.layerGroup().addTo(map);
    const activeMarkers = new Map();

    window.setTimeout(() => {
        map.invalidateSize();
    }, 250);

    window.addEventListener("resize", () => {
        map.invalidateSize();
    });

    loadLocations();

    async function loadLocations() {
        try {
            const dataUrl = new URL(
                "./data/locations.geojson",
                document.baseURI
            );

            const response = await fetch(dataUrl.href, {
                cache: "no-store"
            });

            if (!response.ok) {
                throw new Error(
                    `HTTP-Fehler beim Laden der Orte: ${response.status}`
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

            if (resultCount) {
                resultCount.textContent =
                    "Die Orte konnten nicht geladen werden.";
            }

            if (resultsElement) {
                resultsElement.replaceChildren(
                    createMessage(
                        "Fehler beim Laden von data/locations.geojson."
                    )
                );
            }
        }
    }

    function isValidLocation(location) {
        if (!location || !location.geometry || !location.properties) {
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

    function showLocations(locations, adjustMap) {
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
                        "Setze die Filter zurück oder ändere die Suche."
                    )
                );
            }

            return;
        }

        const bounds = [];

        locations.forEach((location) => {
            const properties = location.properties;
            const coordinates = location.geometry.coordinates;
            const longitude = coordinates[0];
            const latitude = coordinates[1];
            const latitudeLongitude = [latitude, longitude];

            const marker = L.marker(latitudeLongitude, {
                icon: createMarkerIcon(properties.category),
                title: properties.name
            });

            marker.bindPopup(createPopup(location));
            marker.addTo(markerLayer);

            activeMarkers.set(properties.id, marker);
            bounds.push(latitudeLongitude);

            if (resultsElement) {
                resultsElement.appendChild(
                    createResultCard(location)
                );
            }
        });

        if (adjustMap && bounds.length > 1) {
            map.fitBounds(bounds, {
                padding: [45, 45],
                maxZoom: 11
            });
        } else if (adjustMap && bounds.length === 1) {
            map.setView(bounds[0], 13);
        }

        window.setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }

    function createMarkerIcon(category) {
        const markerData = getCategoryData(category);

        return L.divIcon({
            className: "weather-marker-wrapper",
            html:
                `<div class="custom-map-marker ` +
                `${markerData.className}">` +
                `<span>${markerData.icon}</span>` +
                `</div>`,
            iconSize: [42, 42],
            iconAnchor: [21, 40],
            popupAnchor: [0, -38]
        });
    }

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
                className: "marker-nature"
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
                className: "marker-nature"
            },
            "Landesgartenschau 2027": {
                icon: "🌸",
                className: "marker-lgs"
            }
        };

        return categories[category] || {
            icon: "📍",
            className: "marker-town"
        };
    }

    function createPopup(location) {
        const properties = location.properties;
        const popup = document.createElement("article");

        popup.className = "map-popup";

        const image = document.createElement("img");
        image.src =
            properties.image || "./assets/images/placeholder.svg";
        image.alt = properties.image_alt || properties.name;

        image.addEventListener("error", () => {
            image.src = "./assets/images/placeholder.svg";
        });

        const category = document.createElement("p");
        category.className = "popup-category";
        category.textContent =
            properties.category || "Ausflugsziel";

        const title = document.createElement("h3");
        title.textContent = properties.name;

        const municipality = document.createElement("p");
        municipality.textContent =
            properties.municipality || "Wetterau";

        const description = document.createElement("p");
        description.textContent =
            properties.short_description || "";

        popup.append(
            image,
            category,
            title,
            municipality,
            description
        );

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

    function createResultCard(location) {
        const properties = location.properties;
        const card = document.createElement("article");

        card.className = "result-card";

        const image = document.createElement("img");
        image.className = "result-card-image";
        image.src =
            properties.image || "./assets/images/placeholder.svg";
        image.alt = properties.image_alt || properties.name;
        image.loading = "lazy";

        image.addEventListener("error", () => {
            image.src = "./assets/images/placeholder.svg";
        });

        const content = document.createElement("div");
        content.className = "result-card-content";

        const category = document.createElement("p");
        category.className = "result-card-category";
        category.textContent =
            properties.category || "Ausflugsziel";

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

    function createFactsList(properties) {
        const list = document.createElement("ul");
        const facts = [];

        list.className = "result-card-facts";

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

    function createExternalLink(url, text) {
        const link = document.createElement("a");

        link.className = "card-external-link";
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = text;

        return link;
    }

    function showLocationOnMap(location) {
        const coordinates = location.geometry.coordinates;
        const longitude = coordinates[0];
        const latitude = coordinates[1];
        const marker = activeMarkers.get(location.properties.id);

        document.getElementById("karte").scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

        window.setTimeout(() => {
            map.invalidateSize();

            map.setView([latitude, longitude], 15, {
                animate: true
            });

            if (marker) {
                marker.openPopup();
            }
        }, 350);
    }

    function filterLocations() {
        const searchValue = normalizeText(searchInput.value);
        const selectedCategory = categoryFilter.value;

        const filteredLocations = allLocations.filter((location) => {
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
        });

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
        if (!resultCount) {
            return;
        }

        resultCount.textContent =
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

    function showMapError(message) {
        mapElement.classList.add("map-error");
        mapElement.textContent = message;

        if (mapStatus) {
            mapStatus.hidden = true;
        }

        if (resultCount) {
            resultCount.textContent =
                "Die Karte konnte nicht gestartet werden.";
        }
    }

    if (searchInput) {
        searchInput.addEventListener("input", filterLocations);
    }

    if (categoryFilter) {
        categoryFilter.addEventListener(
            "change",
            filterLocations
        );
    }

    if (resetButton) {
        resetButton.addEventListener("click", () => {
            searchInput.value = "";
            categoryFilter.value = "all";

            showLocations(allLocations, true);
            searchInput.focus();
        });
    }
}
