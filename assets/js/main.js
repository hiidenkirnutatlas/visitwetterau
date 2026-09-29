"use strict";

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializeWebsite,
        { once: true }
    );
} else {
    initializeWebsite();
}

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
    const latestLocationsElement =
        document.getElementById("latestLocations");
    const currentYearElement =
        document.getElementById("currentYear");

    let allLocations = [];
    let activeLocationSlug = null;
    let isHandlingBrowserHistory = false;
    let map = null;

    if (currentYearElement) {
        currentYearElement.textContent =
            new Date().getFullYear();
    }

    if (!mapElement) {
        console.error("Kartenelement #map wurde nicht gefunden.");
        return;
    }

    if (typeof window.L === "undefined") {
        showStartupError(
            "Die Kartenbibliothek konnte nicht geladen werden."
        );
        return;
    }

    try {
        map = L.map(mapElement, {
            center: WEATHER_REGION_CENTER,
            zoom: INITIAL_ZOOM,
            scrollWheelZoom: false,
            dragging: true,
            tap: false,
            touchZoom: true
        });
    } catch (error) {
        console.error(
            "Leaflet-Karte konnte nicht initialisiert werden:",
            error
        );

        showStartupError(
            "Die Karte konnte nicht gestartet werden."
        );
        return;
    }

    map.createPane("regionPane");

    const regionPane = map.getPane("regionPane");

    if (regionPane) {
        regionPane.style.zIndex = "350";
        regionPane.style.pointerEvents = "none";
    }

    const markerLayer = L.layerGroup().addTo(map);
    const activeMarkers = new Map();

    const tileLayer = L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution:
                '&copy; <a href="' +
                'https://www.openstreetmap.org/copyright" ' +
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

    registerEventListeners();
    loadWetterauBoundary();
    loadLocations();

    window.setTimeout(() => {
        map.invalidateSize();
    }, 250);

    function registerEventListeners() {
        window.addEventListener("resize", () => {
            map.invalidateSize();
        });

        window.addEventListener("popstate", () => {
            openLocationFromCurrentUrl({
                scrollToMap: false,
                removeInvalidSlug: false
            });
        });

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
                resetLocationFilters
            );
        }
    }

    function resetLocationFilters() {
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
    }

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

            showLatestLocations(allLocations);
            showLocations(allLocations, true);

            window.setTimeout(() => {
                openLocationFromCurrentUrl({
                    scrollToMap: true,
                    removeInvalidSlug: true
                });
            }, 350);
        } catch (error) {
            console.error(
                "Ortsdaten konnten nicht geladen werden:",
                error
            );

            showLocationLoadingError();
        }
    }

    function showLocationLoadingError() {
        if (resultCountElement) {
            resultCountElement.textContent =
                "Orte konnten nicht geladen werden.";
        }

        if (resultsElement) {
            resultsElement.replaceChildren(
                createMessage(
                    "Beim Laden der Orte ist ein Fehler aufgetreten."
                )
            );
        }

        if (latestLocationsElement) {
            latestLocationsElement.replaceChildren(
                createMessage(
                    "Die aktuellen Einträge konnten nicht " +
                    "geladen werden."
                )
            );
        }
    }

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
            Boolean(location?.properties?.slug) &&
            Boolean(location?.properties?.name)
        );
    }

    function showLatestLocations(locations) {
        if (!latestLocationsElement) {
            return;
        }

        latestLocationsElement.replaceChildren();

        const latestLocations = [...locations]
            .filter((location) => {
                return isValidPublishedDate(
                    location.properties.published_at
                );
            })
            .sort((firstLocation, secondLocation) => {
                return (
                    getDateTimestamp(
                        secondLocation.properties.published_at
                    ) -
                    getDateTimestamp(
                        firstLocation.properties.published_at
                    )
                );
            })
            .slice(0, 2);

        if (latestLocations.length === 0) {
            latestLocationsElement.appendChild(
                createMessage(
                    "Noch wurden keine aktuellen Einträge " +
                    "veröffentlicht."
                )
            );
            return;
        }

        latestLocations.forEach((location, index) => {
            latestLocationsElement.appendChild(
                createLatestLocationCard(
                    location,
                    index === 0
                )
            );
        });
    }

    function createLatestLocationCard(
        location,
        isNewest
    ) {
        const properties = location.properties;
        const markerData = getCategoryData(
            properties.category
        );

        const article = document.createElement("article");

        article.className = "latest-card";

        if (isNewest) {
            article.classList.add(
                "latest-card-newest"
            );
        }

        const imageWrapper =
            document.createElement("div");

        imageWrapper.className =
            "latest-card-image-wrapper";

        const image = createLocationImage(
            properties,
            "latest-card-image"
        );

        imageWrapper.appendChild(image);

        if (isNewest) {
            const newestBadge =
                document.createElement("span");

            newestBadge.className =
                "latest-new-badge";
            newestBadge.textContent = "Neu";

            imageWrapper.appendChild(newestBadge);
        }

        const categoryBadge =
            document.createElement("span");

        categoryBadge.className = [
            "latest-category-badge",
            getLatestCategoryClass(
                properties.category
            )
        ]
            .filter(Boolean)
            .join(" ");

        categoryBadge.textContent =
            `${markerData.icon} ` +
            `${properties.category || "Ausflugsziel"}`;

        imageWrapper.appendChild(categoryBadge);

        const content =
            document.createElement("div");

        content.className =
            "latest-card-content";

        const meta =
            document.createElement("p");

        meta.className = "latest-card-meta";
        meta.textContent = [
            properties.municipality,
            properties.area,
            formatPublishedDate(
                properties.published_at
            )
        ]
            .filter(Boolean)
            .join(" · ");

        const title =
            document.createElement("h3");

        title.textContent = properties.name;

        const description =
            document.createElement("p");

        description.className =
            "latest-card-description";

        description.textContent =
            properties.short_description ||
            properties.description ||
            "";

        const facts =
            createLatestFacts(properties);

        const tags = createTagsList(
            properties.tags,
            "latest-card-tags",
            4
        );

        const actions =
            document.createElement("div");

        actions.className =
            "latest-card-actions";

        if (hasDetailPage(properties)) {
            actions.appendChild(
                createDetailLink(
                    properties,
                    "latest-detail-link",
                    "🧭 Ort entdecken"
                )
            );
        }

        const mapButton =
            document.createElement("button");

        mapButton.type = "button";
        mapButton.className =
            "latest-map-button";
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
                createLatestExternalLink(
                    properties.instagram_url,
                    "📸 Instagram"
                )
            );
        }

        content.append(
            meta,
            title,
            description
        );

        if (facts.children.length > 0) {
            content.appendChild(facts);
        }

        if (tags.children.length > 0) {
            content.appendChild(tags);
        }

        content.appendChild(actions);

        article.append(
            imageWrapper,
            content
        );

        return article;
    }

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
            const properties =
                location.properties;

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

            marker.on("popupopen", () => {
                activeLocationSlug =
                    properties.slug;

                if (
                    !isHandlingBrowserHistory
                ) {
                    setLocationUrl(
                        properties.slug,
                        "push"
                    );
                }
            });

            marker.on("popupclose", () => {
                window.setTimeout(() => {
                    if (
                        map._popup ||
                        activeLocationSlug !==
                            properties.slug
                    ) {
                        return;
                    }

                    activeLocationSlug = null;

                    if (
                        !isHandlingBrowserHistory
                    ) {
                        removeLocationFromUrl(
                            "replace"
                        );
                    }
                }, 0);
            });

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

                marker.on(
                    "click",
                    function closePreview() {
                        this.closeTooltip();
                    }
                );
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

        if (
            adjustMap &&
            bounds.length > 1
        ) {
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

    function createMarkerIcon(category) {
        const markerData =
            getCategoryData(category);

        return L.divIcon({
            className:
                "weather-marker-wrapper",
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
                className:
                    "marker-viewpoint"
            },
            Geschichte: {
                icon: "🏺",
                className:
                    "marker-history"
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

    function createLocationPreview(
        location
    ) {
        const properties =
            location.properties;

        const markerData =
            getCategoryData(
                properties.category
            );

        const preview =
            document.createElement("article");

        preview.className =
            "marker-hover-card";

        const image =
            createLocationImage(
                properties,
                ""
            );

        image.alt = "";

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

        const mediaBadges =
            createAvailableMediaBadges(
                properties
            );

        if (
            mediaBadges.children.length > 0
        ) {
            body.appendChild(mediaBadges);
        }

        const hint =
            document.createElement("span");

        hint.className =
            "marker-hover-hint";

        hint.textContent =
            hasDetailPage(properties)
                ? "Klicken für Details und Ortsseite"
                : "Klicken für Details und Links";

        body.appendChild(hint);
        preview.append(image, body);

        return preview;
    }

    function createPopup(location) {
        const properties =
            location.properties;

        const markerData =
            getCategoryData(
                properties.category
            );

        const popup =
            document.createElement("article");

        popup.className = "map-popup";

        const image =
            createLocationImage(
                properties,
                "map-popup-image"
            );

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

        if (hasDetailPage(properties)) {
            popup.appendChild(
                createDetailLink(
                    properties,
                    "popup-detail-link",
                    "🧭 Ausführliche Ortsseite"
                )
            );
        }

        const links =
            createPopupLinks(properties);

        if (links.children.length > 0) {
            popup.appendChild(links);
        }

        return popup;
    }

    function createResultCard(location) {
        const properties =
            location.properties;

        const markerData =
            getCategoryData(
                properties.category
            );

        const card =
            document.createElement("article");

        card.className = "result-card";
        card.dataset.locationId =
            properties.id;

        const image =
            createLocationImage(
                properties,
                "result-card-image"
            );

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

    function createCardActions(location) {
        const properties =
            location.properties;

        const actions =
            document.createElement("div");

        actions.className =
            "result-card-actions";

        if (hasDetailPage(properties)) {
            actions.appendChild(
                createDetailLink(
                    properties,
                    "card-detail-link",
                    "🧭 Ort entdecken"
                )
            );
        }

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

    function createDetailLink(
        properties,
        className,
        label
    ) {
        const link =
            document.createElement("a");

        link.className = className;
        link.href = resolveUrl(
            properties.detail_url
        );
        link.textContent = label;

        link.setAttribute(
            "aria-label",
            `${properties.name} ausführlich entdecken`
        );

        return link;
    }

    function createLatestExternalLink(
        url,
        label
    ) {
        const link =
            document.createElement("a");

        link.className =
            "latest-external-link";
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = label;

        link.setAttribute(
            "aria-label",
            `${label} in einem neuen Tab öffnen`
        );

        return link;
    }

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

    function createLocationImage(
        properties,
        className
    ) {
        const image =
            document.createElement("img");

        if (className) {
            image.className = className;
        }

        image.src =
            properties.image ||
            FALLBACK_IMAGE;

        image.alt =
            properties.image_alt ||
            properties.name ||
            "";

        image.loading = "lazy";

        setFallbackImage(image);

        return image;
    }

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

                item.textContent =
                    `#${tag
                        .trim()
                        .replace(/\s+/g, "")}`;

                list.appendChild(item);
            });

        return list;
    }

    function createAvailableMediaBadges(
        properties
    ) {
        const container =
            document.createElement("div");

        container.className =
            "marker-hover-media";

        if (hasDetailPage(properties)) {
            appendMediaBadge(
                container,
                "🧭 Ortsseite"
            );
        }

        if (
            isUsableUrl(
                properties.instagram_url
            )
        ) {
            appendMediaBadge(
                container,
                "📸 Instagram"
            );
        }

        if (
            isUsableUrl(
                properties.youtube_url
            )
        ) {
            appendMediaBadge(
                container,
                "▶️ YouTube"
            );
        }

        if (
            isUsableUrl(
                properties.website_url
            )
        ) {
            appendMediaBadge(
                container,
                "🔗 Infos"
            );
        }

        return container;
    }

    function appendMediaBadge(
        container,
        text
    ) {
        const badge =
            document.createElement("span");

        badge.textContent = text;
        container.appendChild(badge);
    }

    function createLatestFacts(properties) {
        const list =
            document.createElement("ul");

        list.className =
            "latest-card-facts";

        const facts = [];

        if (properties.visit_time) {
            facts.push(
                `⏱ ${properties.visit_time}`
            );
        }

        if (properties.best_season) {
            facts.push(
                `🍂 ${properties.best_season}`
            );
        }

        if (
            properties.family_friendly ===
            true
        ) {
            facts.push(
                "👨‍👩‍👧 Familiengeeignet"
            );
        }

        appendFacts(list, facts);

        return list;
    }

    function createFactsList(properties) {
        const list =
            document.createElement("ul");

        list.className =
            "result-card-facts";

        appendFacts(
            list,
            getLocationFacts(properties)
        );

        return list;
    }

    function createPopupFacts(properties) {
        const list =
            document.createElement("ul");

        list.className = "popup-facts";

        appendFacts(
            list,
            getLocationFacts(properties)
        );

        return list;
    }

    function appendFacts(list, facts) {
        facts.forEach((fact) => {
            const item =
                document.createElement("li");

            item.textContent = fact;
            list.appendChild(item);
        });
    }

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
            properties.family_friendly ===
            true
        ) {
            facts.push("👨‍👩‍👧 Familie");
        }

        if (
            properties.accessible === true
        ) {
            facts.push("♿ Barrierearm");
        }

        if (properties.best_season) {
            facts.push(
                `🍂 ${properties.best_season}`
            );
        }

        return facts;
    }

    function getLatestCategoryClass(
        category
    ) {
        const categoryClasses = {
            "Burg und Schloss":
                "latest-category-castle",
            Natur:
                "latest-category-nature",
            Aussichtspunkt:
                "latest-category-viewpoint",
            Geschichte:
                "latest-category-history",
            "Stadt und Fachwerk":
                "latest-category-town",
            Genuss:
                "latest-category-food",
            "Landesgartenschau 2027":
                "latest-category-lgs"
        };

        return (
            categoryClasses[category] ||
            "latest-category-default"
        );
    }

    function filterLocations() {
        const searchValue =
            normalizeText(
                searchInput
                    ? searchInput.value
                    : ""
            );

        const selectedCategory =
            categoryFilter
                ? categoryFilter.value
                : "all";

        const filteredLocations =
            allLocations.filter(
                (location) => {
                    const properties =
                        location.properties;

                    const tags =
                        Array.isArray(
                            properties.tags
                        )
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
                        selectedCategory ===
                            "all" ||
                        properties.category ===
                            selectedCategory;

                    return (
                        matchesSearch &&
                        matchesCategory
                    );
                }
            );

        showLocations(
            filteredLocations,
            false
        );
    }

    function showLocationOnMap(location) {
        const [longitude, latitude] =
            location.geometry.coordinates;

        let marker = activeMarkers.get(
            location.properties.id
        );

        if (!marker) {
            if (searchInput) {
                searchInput.value = "";
            }

            if (categoryFilter) {
                categoryFilter.value = "all";
            }

            showLocations(
                allLocations,
                false
            );

            marker = activeMarkers.get(
                location.properties.id
            );
        }

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

    function setLocationUrl(
        slug,
        historyMethod = "push"
    ) {
        if (
            typeof slug !== "string" ||
            !slug.trim()
        ) {
            return;
        }

        const url =
            new URL(window.location.href);

        const normalizedSlug = slug.trim();

        if (
            url.searchParams.get("ort") ===
            normalizedSlug
        ) {
            return;
        }

        url.searchParams.set(
            "ort",
            normalizedSlug
        );

        const state = {
            locationSlug: normalizedSlug
        };

        if (
            historyMethod === "replace"
        ) {
            window.history.replaceState(
                state,
                "",
                url
            );
        } else {
            window.history.pushState(
                state,
                "",
                url
            );
        }
    }

    function removeLocationFromUrl(
        historyMethod = "replace"
    ) {
        const url =
            new URL(window.location.href);

        if (!url.searchParams.has("ort")) {
            return;
        }

        url.searchParams.delete("ort");

        if (historyMethod === "push") {
            window.history.pushState(
                {},
                "",
                url
            );
        } else {
            window.history.replaceState(
                {},
                "",
                url
            );
        }
    }

    function getLocationSlugFromUrl() {
        const url =
            new URL(window.location.href);

        const slug =
            url.searchParams.get("ort");

        return slug ? slug.trim() : "";
    }

    function findLocationBySlug(slug) {
        if (!slug) {
            return null;
        }

        return (
            allLocations.find((location) => {
                return (
                    location.properties.slug ===
                    slug
                );
            }) || null
        );
    }

    function openLocationBySlug(
        slug,
        {
            scrollToMap = true,
            zoom = 14
        } = {}
    ) {
        const location =
            findLocationBySlug(slug);

        if (!location) {
            return false;
        }

        let marker = activeMarkers.get(
            location.properties.id
        );

        if (!marker) {
            if (searchInput) {
                searchInput.value = "";
            }

            if (categoryFilter) {
                categoryFilter.value = "all";
            }

            showLocations(
                allLocations,
                false
            );

            marker = activeMarkers.get(
                location.properties.id
            );
        }

        if (!marker) {
            return false;
        }

        const [longitude, latitude] =
            location.geometry.coordinates;

        if (scrollToMap) {
            const mapSection =
                document.getElementById(
                    "karte"
                );

            if (mapSection) {
                mapSection.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }
        }

        window.setTimeout(() => {
            map.invalidateSize();

            map.setView(
                [latitude, longitude],
                zoom,
                {
                    animate: true
                }
            );

            marker.openPopup();
        }, scrollToMap ? 300 : 0);

        return true;
    }

    function openLocationFromCurrentUrl(
        {
            scrollToMap = false,
            removeInvalidSlug = false
        } = {}
    ) {
        const slug =
            getLocationSlugFromUrl();

        if (!slug) {
            isHandlingBrowserHistory = true;

            map.closePopup();
            activeLocationSlug = null;

            window.setTimeout(() => {
                isHandlingBrowserHistory =
                    false;
            }, 50);

            return;
        }

        isHandlingBrowserHistory = true;

        const wasOpened =
            openLocationBySlug(
                slug,
                {
                    scrollToMap,
                    zoom: 14
                }
            );

        if (wasOpened) {
            activeLocationSlug = slug;
        } else if (removeInvalidSlug) {
            removeLocationFromUrl(
                "replace"
            );
        }

        window.setTimeout(() => {
            isHandlingBrowserHistory = false;
        }, scrollToMap ? 450 : 100);
    }

    function resolveUrl(value) {
        if (
            typeof value !== "string" ||
            !value.trim()
        ) {
            return "";
        }

        try {
            return new URL(
                value.trim(),
                window.location.origin
            ).href;
        } catch (error) {
            return "";
        }
    }

    function hasDetailPage(properties) {
        return Boolean(
            resolveUrl(
                properties.detail_url
            )
        );
    }

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

    function isValidPublishedDate(value) {
        if (
            typeof value !== "string" ||
            !value.trim()
        ) {
            return false;
        }

        return !Number.isNaN(
            getDateTimestamp(value)
        );
    }

    function getDateTimestamp(value) {
        return new Date(
            `${value}T12:00:00`
        ).getTime();
    }

    function formatPublishedDate(value) {
        if (!isValidPublishedDate(value)) {
            return "";
        }

        return new Intl.DateTimeFormat(
            "de-DE",
            {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            }
        ).format(
            new Date(
                `${value}T12:00:00`
            )
        );
    }

    function normalizeText(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(
                /[\u0300-\u036f]/g,
                ""
            )
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
        const message =
            document.createElement("p");

        message.className =
            "empty-results";
        message.textContent = text;

        return message;
    }

    function showMapStatus(message) {
        if (!mapStatusElement) {
            return;
        }

        mapStatusElement.hidden = false;
        mapStatusElement.textContent =
            message;
    }

    function hideMapStatus() {
        if (!mapStatusElement) {
            return;
        }

        mapStatusElement.hidden = true;
    }

    function showStartupError(message) {
        mapElement.classList.add(
            "map-error"
        );
        mapElement.textContent = message;

        if (mapStatusElement) {
            mapStatusElement.hidden = true;
        }

        if (resultCountElement) {
            resultCountElement.textContent =
                "Die Karte konnte nicht geladen werden.";
        }

        if (latestLocationsElement) {
            latestLocationsElement.replaceChildren(
                createMessage(
                    "Die aktuellen Einträge konnten " +
                    "nicht geladen werden."
                )
            );
        }
    }
}
