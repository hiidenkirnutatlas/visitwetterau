"use strict";

const WEATHER_REGION_CENTER = [50.34, 8.93];
const INITIAL_ZOOM = 10;

const map = L.map("map", {
    scrollWheelZoom: false
}).setView(WEATHER_REGION_CENTER, INITIAL_ZOOM);

L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        attribution:
            "© OpenStreetMap-Mitwirkende",
        maxZoom: 19
    }
).addTo(map);

L.control.scale({
    imperial: false,
    metric: true
}).addTo(map);

map.on("focus", () => {
    map.scrollWheelZoom.enable();
});

map.on("blur", () => {
    map.scrollWheelZoom.disable();
});

let allLocations = [];
let markerLayer = L.layerGroup().addTo(map);
let activeMarkers = new Map();

const searchInput = document.querySelector("#searchInput");
const categoryFilter = document.querySelector("#categoryFilter");
const resetFiltersButton = document.querySelector("#resetFilters");
const resultsElement = document.querySelector("#results");
const resultCountElement = document.querySelector("#resultCount");
const currentYearElement = document.querySelector("#currentYear");

currentYearElement.textContent = new Date().getFullYear();

loadLocations();

async function loadLocations() {
    try {
        const response = await fetch("data/locations.geojson");

        if (!response.ok) {
            throw new Error(
                `Ortsdaten konnten nicht geladen werden: ${response.status}`
            );
        }

        const data = await response.json();

        if (!Array.isArray(data.features)) {
            throw new Error("Die GeoJSON-Datei enthält keine Orte.");
        }

        allLocations = data.features.filter(isValidLocation);

        showLocations(allLocations, true);
    } catch (error) {
        console.error(error);

        resultCountElement.textContent =
            "Die Orte konnten nicht geladen werden.";

        resultsElement.replaceChildren(
            createMessage(
                "Beim Laden der Ortsdaten ist ein Fehler aufgetreten. " +
                "Prüfe die Datei data/locations.geojson."
            )
        );
    }
}

function isValidLocation(location) {
    const coordinates = location?.geometry?.coordinates;

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

function showLocations(locations, adjustMap = false) {
    markerLayer.clearLayers();
    activeMarkers.clear();
    resultsElement.replaceChildren();

    updateResultCount(locations.length);

    if (locations.length === 0) {
        resultsElement.appendChild(
            createMessage(
                "Für diese Suche wurden keine Orte gefunden. " +
                "Versuche einen anderen Suchbegriff oder setze die Filter zurück."
            )
        );

        return;
    }

    const bounds = [];

    locations.forEach((location) => {
        const properties = location.properties;
        const [longitude, latitude] = location.geometry.coordinates;
        const coordinates = [latitude, longitude];

        const marker = L.marker(coordinates, {
            icon: createMarkerIcon(properties.category),
            title: properties.name,
            alt: properties.name
        });

        marker.bindPopup(createPopup(location));
        marker.addTo(markerLayer);

        activeMarkers.set(properties.id, marker);
        bounds.push(coordinates);

        resultsElement.appendChild(createResultCard(location));
    });

    if (adjustMap && bounds.length > 1) {
        map.fitBounds(bounds, {
            padding: [45, 45],
            maxZoom: 11
        });
    }

    if (adjustMap && bounds.length === 1) {
        map.setView(bounds[0], 13);
    }
}

function createMarkerIcon(category) {
    const markerData = getCategoryData(category);

    return L.divIcon({
        className: "",
        html:
            `<div class="custom-map-marker ${markerData.className}">` +
            `<span aria-hidden="true">${markerData.icon}</span>` +
            "</div>",
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
        properties.image || "assets/images/placeholder.svg";
    image.alt = properties.image_alt || properties.name;
    image.loading = "lazy";

    image.addEventListener("error", () => {
        image.src = "assets/images/placeholder.svg";
    });

    const category = document.createElement("p");
    category.className = "popup-category";
    category.textContent = properties.category || "Ausflugsziel";

    const title = document.createElement("h3");
    title.textContent = properties.name;

    const municipality = document.createElement("p");
    municipality.textContent = properties.municipality || "Wetterau";

    const description = document.createElement("p");
    description.textContent = properties.short_description || "";

    popup.append(image, category, title, municipality, description);

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
        properties.image || "assets/images/placeholder.svg";
    image.alt = properties.image_alt || properties.name;
    image.loading = "lazy";

    image.addEventListener("error", () => {
        image.src = "assets/images/placeholder.svg";
    });

    const content = document.createElement("div");
    content.className = "result-card-content";

    const category = document.createElement("p");
    category.className = "result-card-category";
    category.textContent = properties.category || "Ausflugsziel";

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

function showLocationOnMap(location) {
    const [longitude, latitude] = location.geometry.coordinates;
    const marker = activeMarkers.get(location.properties.id);

    map.setView([latitude, longitude], 15, {
        animate: true
    });

    if (marker) {
        marker.openPopup();
    }

    document.querySelector("#karte").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function filterLocations() {
    const searchValue = normalizeText(searchInput.value);
    const selectedCategory = categoryFilter.value;

    const filteredLocations = allLocations.filter((location) => {
        const properties = location.properties;

        const searchableContent = [
            properties.name,
            properties.municipality,
            properties.area,
            properties.category,
            properties.description,
            properties.short_description,
            ...(properties.tags || [])
        ]
            .filter(Boolean)
            .join(" ");

        const matchesSearch =
            normalizeText(searchableContent).includes(searchValue);

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
    if (count === 1) {
        resultCountElement.textContent = "1 Ort gefunden";
        return;
    }

    resultCountElement.textContent = `${count} Orte gefunden`;
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

        return url.protocol === "https:" || url.protocol === "http:";
    } catch {
        return false;
    }
}

searchInput.addEventListener("input", filterLocations);
categoryFilter.addEventListener("change", filterLocations);

resetFiltersButton.addEventListener("click", () => {
    searchInput.value = "";
    categoryFilter.value = "all";

    showLocations(allLocations, true);
    searchInput.focus();
});
