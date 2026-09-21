"use strict";

document.addEventListener("DOMContentLoaded", initializeWebsite);

function initializeWebsite() {
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
        console.error("Kartenelement #map wurde nicht gefunden.");
        return;
    }

    if (typeof L === "undefined") {
        showMapError("Kartenbibliothek konnte nicht geladen werden.");
        return;
    }

    const WEATHER_REGION_CENTER = [50.34, 8.93];
    const INITIAL_ZOOM = 10;

    const map = L.map(mapElement, {
        center: WEATHER_REGION_CENTER,
        zoom: INITIAL_ZOOM,
        scrollWheelZoom: false,
        zoomControl: true,
        attributionControl: true
    });

    // Eigene Ebene für die Umrandung (unter den Markern)
    map.createPane("regionPane");
    const regionPane = map.getPane("regionPane");
    if (regionPane) {
        regionPane.style.zIndex = "350";
        regionPane.style.pointerEvents = "none";
    }

    const tileLayer = L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
        }
    );

    tileLayer.on("load", hideMapStatus);
    tileLayer.on("tileerror", () => showMapStatus("Kartenkacheln konnten nicht vollständig geladen werden."));
    tileLayer.addTo(map);

    L.control.scale({ imperial: false, metric: true }).addTo(map);

    let allLocations = [];
    const markerLayer = L.layerGroup().addTo(map);
    const activeMarkers = new Map();

    loadWetterauBoundary();
    loadLocations();

    window.setTimeout(() => map.invalidateSize(), 250);
    window.addEventListener("resize", () => map.invalidateSize());

    map.on("movestart zoomstart", () => {
        map.closeTooltip();
    });

    // Grenze laden
    async function loadWetterauBoundary() {
        try {
            const boundaryUrl = new URL("./data/wetteraukreis.geojson", document.baseURI);
            const response = await fetch(boundaryUrl.href, { cache: "no-store" });
            if (!response.ok) return;

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
            console.warn("Wetteraukreis-Grenze nicht geladen:", error);
        }
    }

    // Orte laden
    async function loadLocations() {
        try {
            const locationsUrl = new URL("./data/locations.geojson", document.baseURI);
            const response = await fetch(locationsUrl.href, { cache: "no-store" });
            if (!response.ok) throw new Error("Fehler beim Laden: " + response.status);

            const data = await response.json();
            if (!Array.isArray(data.features)) throw new Error("Kein features-Array");

            allLocations = data.features.filter(isValidLocation);
            showLocations(allLocations, true);
        } catch (error) {
            console.error(error);
            if (resultCountElement) resultCountElement.textContent = "Orte konnten nicht geladen werden.";
            if (resultsElement) {
                resultsElement.replaceChildren(
                    createMessage("Beim Laden der Orte ist ein Fehler aufgetreten.")
                );
            }
        }
    }

    function isValidLocation(loc) {
        const coords = loc?.geometry?.coordinates;
        return (
            loc?.geometry?.type === "Point" &&
            Array.isArray(coords) &&
            coords.length >= 2 &&
            Number.isFinite(coords[0]) &&
            Number.isFinite(coords[1]) &&
            Boolean(loc?.properties?.id) &&
            Boolean(loc?.properties?.name)
        );
    }

    function showLocations(locations, adjustMap = false) {
        markerLayer.clearLayers();
        activeMarkers.clear();

        if (resultsElement) resultsElement.replaceChildren();
        updateResultCount(locations.length);

        if (locations.length === 0) {
            if (resultsElement) {
                resultsElement.appendChild(
                    createMessage("Keine passenden Orte gefunden. Bitte Filter zurücksetzen.")
                );
            }
            return;
        }

        const bounds = [];
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        locations.forEach((location) => {
            const props = location.properties;
            const [lng, lat] = location.geometry.coordinates;
            const latLng = [lat, lng];

            const marker = L.marker(latLng, {
                icon: createMarkerIcon(props.category),
                title: props.name,
                keyboard: true,
                riseOnHover: true
            });

            // Großes Popup mit automatischem Pan
            marker.bindPopup(createPopup(location), {
                maxWidth: 300,
                minWidth: 260,
                autoPan: true,
                autoPanPadding: [40, 40],
                autoPanPaddingTopLeft: [40, 40],
                autoPanPaddingBottomRight: [40, 40],
                closeButton: true
            });

            // Hover-Vorschau nur auf Geräten mit Maus (verhindert Doppelklick auf Touch)
            if (!isTouchDevice) {
                marker.bindTooltip(createLocationPreview(location), {
                    direction: "top",
                    offset: [0, -28],
                    opacity: 1,
                    className: "location-preview-tooltip",
                    interactive: false
                });

                marker.on("mouseover", function () {
                    if (!this.isPopupOpen()) {
                        this.openTooltip();
                    }
                });

                marker.on("mouseout", function () {
                    this.closeTooltip();
                });
            }

            // Beim direkten Klick: Tooltip sofort weg, Popup auf, leicht anzentrieren
            marker.on("click", function () {
                this.closeTooltip();
                map.flyTo(latLng, Math.max(map.getZoom(), 13), {
                    animate: true,
                    duration: 0.5
                });
            });

            marker.addTo(markerLayer);
            activeMarkers.set(props.id, marker);
            bounds.push(latLng);

            if (resultsElement) {
                resultsElement.appendChild(createResultCard(location));
            }
        });

        if (adjustMap && bounds.length > 1) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 11 });
        } else if (adjustMap && bounds.length === 1) {
            map.setView(bounds[0], 13);
        }

        window.setTimeout(() => map.invalidateSize(), 100);
    }

    function createMarkerIcon(category) {
        const markerData = getCategoryData(category);
        return L.divIcon({
            className: "weather-marker-wrapper",
            html: `<div class="emoji-marker ${markerData.className}"><span>${markerData.icon}</span></div>`,
            iconSize: [52, 52],
            iconAnchor: [26, 26],
            popupAnchor: [0, -28],
            tooltipAnchor: [0, -28]
        });
    }

    function getCategoryData(category) {
        const categories = {
            "Burg und Schloss": { icon: "🏰", className: "marker-castle" },
            "Natur": { icon: "🌳", className: "marker-nature" },
            "Aussichtspunkt": { icon: "🌄", className: "marker-viewpoint" },
            "Geschichte": { icon: "🏺", className: "marker-history" },
            "Stadt und Fachwerk": { icon: "🏘️", className: "marker-town" },
            "Genuss": { icon: "🍎", className: "marker-food" },
            "Landesgartenschau 2027": { icon: "🌸", className: "marker-lgs" }
        };
        return categories[category] || { icon: "📍", className: "marker-default" };
    }

    function createLocationPreview(location) {
        const props = location.properties;
        const markerData = getCategoryData(props.category);

        const preview = document.createElement("article");
        preview.className = "marker-preview-card";

        const image = document.createElement("img");
        image.className = "marker-preview-image";
        image.src = props.image || "./assets/images/placeholder.svg";
        image.alt = "";
        image.loading = "lazy";
        image.onerror = () => { image.src = "./assets/images/placeholder.svg"; };

        const content = document.createElement("div");
        content.className = "marker-preview-content";

        const category = document.createElement("p");
        category.className = "marker-preview-category";
        category.textContent = `${markerData.icon} ${props.category || "Ausflugsziel"}`;

        const title = document.createElement("strong");
        title.className = "marker-preview-title";
        title.textContent = props.name;

        const locationText = document.createElement("p");
        locationText.className = "marker-preview-location";
        locationText.textContent = [props.municipality, props.area].filter(Boolean).join(" · ");

        const description = document.createElement("p");
        description.className = "marker-preview-description";
        description.textContent = props.short_description || props.description || "";

        const hint = document.createElement("span");
        hint.className = "marker-preview-hint";
        hint.textContent = "Klicken für Details";

        content.append(category, title, locationText, description, hint);
        preview.append(image, content);
        return preview;
    }

    function createPopup(location) {
        const props = location.properties;
        const markerData = getCategoryData(props.category);

        const popup = document.createElement("article");
        popup.className = "map-popup";

        const image = document.createElement("img");
        image.className = "map-popup-image";
        image.src = props.image || "./assets/images/placeholder.svg";
        image.alt = props.image_alt || props.name;
        image.loading = "lazy";
        image.onerror = () => { image.src = "./assets/images/placeholder.svg"; };

        const category = document.createElement("p");
        category.className = "popup-category";
        category.textContent = `${markerData.icon} ${props.category || "Ausflugsziel"}`;

        const title = document.createElement("h3");
        title.textContent = props.name;

        const locationText = document.createElement("p");
        locationText.className = "popup-location";
        locationText.textContent = [props.municipality, props.area].filter(Boolean).join(" · ");

        const description = document.createElement("p");
        description.className = "popup-description";
        description.textContent = props.short_description || props.description || "";

        popup.append(image, category, title, locationText, description);

        const facts = createPopupFacts(props);
        if (facts.children.length > 0) popup.appendChild(facts);

        if (isUsableUrl(props.website_url)) {
            const link = document.createElement("a");
            link.className = "popup-button";
            link.href = props.website_url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = "Weitere Informationen";
            popup.appendChild(link);
        }

        return popup;
    }

    function createPopupFacts(props) {
        const list = document.createElement("ul");
        list.className = "popup-facts";
        const facts = [];

        if (props.visit_time) facts.push(`⏱ ${props.visit_time}`);
        if (props.parking === true) facts.push("🚗 Parkplatz");
        if (props.family_friendly === true) facts.push("👨‍👩‍👧 Familie");
        if (props.accessible === true) facts.push("♿ Barrierearm");

        facts.forEach((fact) => {
            const item = document.createElement("li");
            item.textContent = fact;
            list.appendChild(item);
        });
        return list;
    }

    function createResultCard(location) {
        const props = location.properties;
        const markerData = getCategoryData(props.category);

        const card = document.createElement("article");
        card.className = "result-card";
        card.dataset.locationId = props.id;

        const image = document.createElement("img");
        image.className = "result-card-image";
        image.src = props.image || "./assets/images/placeholder.svg";
        image.alt = props.image_alt || props.name;
        image.loading = "lazy";
        image.onerror = () => { image.src = "./assets/images/placeholder.svg"; };

        const content = document.createElement("div");
        content.className = "result-card-content";

        const category = document.createElement("p");
        category.className = "result-card-category";
        category.textContent = `${markerData.icon} ${props.category || "Ausflugsziel"}`;

        const title = document.createElement("h3");
        title.textContent = props.name;

        const locationText = document.createElement("p");
        locationText.className = "result-card-location";
        locationText.textContent = [props.municipality, props.area].filter(Boolean).join(" · ");

        const description = document.createElement("p");
        description.className = "result-card-description";
        description.textContent = props.description || props.short_description || "";

        const facts = createFactsList(props);
        const actions = createCardActions(location);

        content.append(category, title, locationText, description);
        if (facts.children.length > 0) content.appendChild(facts);
        content.appendChild(actions);

        card.append(image, content);
        return card;
    }

    function createFactsList(props) {
        const list = document.createElement("ul");
        list.className = "result-card-facts";
        const facts = [];

        if (props.visit_time) facts.push(`⏱ ${props.visit_time}`);
        if (props.parking === true) facts.push("🚗 Parkplatz");
        if (props.family_friendly === true) facts.push("👨‍👩‍👧 Familie");
        if (props.accessible === true) facts.push("♿ Barrierearm");

        facts.forEach((fact) => {
            const item = document.createElement("li");
            item.textContent = fact;
            list.appendChild(item);
        });
        return list;
    }

    function createCardActions(location) {
        const props = location.properties;
        const actions = document.createElement("div");
        actions.className = "result-card-actions";

        const mapButton = document.createElement("button");
        mapButton.className = "card-map-button";
        mapButton.type = "button";
        mapButton.textContent = "Auf Karte zeigen";
        mapButton.addEventListener("click", () => showLocationOnMap(location));
        actions.appendChild(mapButton);

        if (isUsableUrl(props.youtube_url)) {
            actions.appendChild(createExternalLink(props.youtube_url, "YouTube"));
        } else if (isUsableUrl(props.instagram_url)) {
            actions.appendChild(createExternalLink(props.instagram_url, "Instagram"));
        } else if (isUsableUrl(props.website_url)) {
            actions.appendChild(createExternalLink(props.website_url, "Mehr erfahren"));
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
        const [lng, lat] = location.geometry.coordinates;
        const marker = activeMarkers.get(location.properties.id);
        const mapSection = document.getElementById("karte");

        if (mapSection) {
            mapSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        window.setTimeout(() => {
            map.invalidateSize();
            map.flyTo([lat, lng], 14, { animate: true, duration: 0.8 });
            if (marker) {
                marker.closeTooltip();
                marker.openPopup();
            }
        }, 300);
    }

    function filterLocations() {
        const searchValue = normalizeText(searchInput ? searchInput.value : "");
        const selectedCategory = categoryFilter ? categoryFilter.value : "all";

        const filteredLocations = allLocations.filter((location) => {
            const props = location.properties;
            const tags = Array.isArray(props.tags) ? props.tags : [];
            const searchableContent = [
                props.name,
                props.municipality,
                props.area,
                props.category,
                props.description,
                props.short_description,
                props.best_season,
                ...tags
            ].filter(Boolean).join(" ");

            const matchesSearch = normalizeText(searchableContent).includes(searchValue);
            const matchesCategory = selectedCategory === "all" || props.category === selectedCategory;

            return matchesSearch && matchesCategory;
        });

        showLocations(filteredLocations, false);
    }

    function normalizeText(val) {
        return String(val || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase("de")
            .trim();
    }

    function updateResultCount(count) {
        if (!resultCountElement) return;
        resultCountElement.textContent = count === 1 ? "1 Ort gefunden" : `${count} Orte gefunden`;
    }

    function createMessage(text) {
        const msg = document.createElement("p");
        msg.className = "empty-results";
        msg.textContent = text;
        return msg;
    }

    function isUsableUrl(val) {
        if (!val) return false;
        try {
            const u = new URL(val);
            return u.protocol === "https:" || u.protocol === "http:";
        } catch {
            return false;
        }
    }

    function showMapStatus(msg) {
        if (!mapStatusElement) return;
        mapStatusElement.hidden = false;
        mapStatusElement.textContent = msg;
    }

    function hideMapStatus() {
        if (!mapStatusElement) return;
        mapStatusElement.hidden = true;
    }

    function showMapError(msg) {
        mapElement.classList.add("map-error");
        mapElement.textContent = msg;
        hideMapStatus();
        if (resultCountElement) resultCountElement.textContent = "Karte konnte nicht geladen werden.";
    }

    if (searchInput) searchInput.addEventListener("input", filterLocations);
    if (categoryFilter) categoryFilter.addEventListener("change", filterLocations);
    if (resetFiltersButton) {
        resetFiltersButton.addEventListener("click", () => {
            if (searchInput) searchInput.value = "";
            if (categoryFilter) categoryFilter.value = "all";
            showLocations(allLocations, true);
            if (searchInput) searchInput.focus();
        });
    }
}
