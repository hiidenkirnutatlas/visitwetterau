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
    const resetFiltersButton = document.getElementById("resetFilters");
    const resultsElement = document.getElementById("results");
    const resultCountElement = document.getElementById("resultCount");
    const latestLocationsElement =
        document.getElementById("latestLocations");
    const currentYearElement = document.getElementById("currentYear");

    let allLocations = [];
    let activeLocationSlug = null;
    let isHandlingBrowserHistory = false;

    if (currentYearElement) {
        currentYearElement.textContent = new Date().getFullYear();
    }

    if (!mapElement) {
        console.error("Kartenelement #map wurde nicht gefunden.");
        return;
    }

    if (typeof L === "undefined") {
        showMapError("Die Kartenbibliothek konnte nicht geladen werden.");
        return;
    }

    const map = L.map(mapElement, {
        center: WEATHER_REGION_CENTER,
        zoom: INITIAL_ZOOM,
        scrollWheelZoom: false,
        dragging: true,
        tap: false,
        touchZoom: true
    });

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
                '&copy; <a href="https://www.openstreetmap.org/' +
                'copyright" target="_blank" ' +
                'rel="noopener noreferrer">' +
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

    loadWetterauBoundary();
    loadLocations();

    window.setTimeout(() => {
        map.invalidateSize();
    }, 250);

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
        searchInput.addEventListener("input", filterLocations);
    }

    if (categoryFilter) {
        categoryFilter.addEventListener("change", filterLocations);
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

            allLocations = data.features.filter(isValidLocation);

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
                        "Die aktuellen Einträge konnten nicht geladen werden."
                    )
                );
            }
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
                const firstDate = new Date(
                    `${firstLocation.properties.published_at}T12:00:00`
                );

                const secondDate = new Date(
                    `${secondLocation.properties.published_at}T12:00:00`
                );

                return secondDate.getTime() - firstDate.getTime();
            })
            .slice(0, 2);

        if (latestLocations.length === 0) {
            latestLocationsElement.appendChild(
                createMessage(
                    "Noch wurden keine aktuellen Einträge veröffentlicht."
                )
            );

            return;
        }

        latestLocations.forEach((location, index) => {
            latestLocationsElement.appendChild(
                createLatestLocationCard(location, index === 0)
            );
        });
    }

    function createLatestLocationCard(location, isNewest) {
        const properties = location.properties;
        const markerData = getCategoryData(properties.category);

        const article = document.createElement("article");

        article.className = "latest-card";

        if (isNewest) {
            article.classList.add("latest-card-newest");
        }

        const imageWrapper = document.createElement("div");

        imageWrapper.className = "latest-card-image-wrapper";

        const image = createLocationImage(
            properties,
            "latest-card-image"
        );

        imageWrapper.appendChild(image);

        if (isNewest) {
            const newestBadge = document.createElement("span");

            newestBadge.className = "latest-new-badge";
            newestBadge.textContent = "Neu";

            imageWrapper.appendChild(newestBadge);
        }

        const categoryBadge = document.createElement("span");

        categoryBadge.className = [
            "latest-category-badge",
            getLatestCategoryClass(properties.category)
        ]
            .filter(Boolean)
            .join(" ");

        categoryBadge.textContent =
            `${markerData.icon} ` +
            `${properties.category || "Ausflugsziel"}`;

        imageWrapper.appendChild(categoryBadge);

        const content = document.createElement("div");

        content.className = "latest-card-content";

        const meta = document.createElement("p");

        meta.className = "latest-card-meta";
        meta.textContent = [
            properties.municipality,
            properties.area,
            formatPublishedDate(properties.published_at)
        ]
            .filter(Boolean)
            .join(" · ");

        const title = document.createElement("h3");

        title.textContent = properties.name;

        const description = document.createElement("p");

        description.className = "latest-card-description";
        description.textContent =
            properties.short_description ||
            properties.description ||
            "";

        const facts = createLatestFacts(properties);

        const tags = createTagsList(
            properties.tags,
            "latest-card-tags",
            4
        );

        const actions = document.createElement("div");

        actions.className = "latest-card-actions";

        if (hasDetailPage(properties)) {
            actions.appendChild(
                createDetailLink(
                    properties,
                    "latest-detail-link",
                    "🧭 Ort entdecken"
                )
            );
        }

        const mapButton = document.createElement("button");

        mapButton.type = "button";
        mapButton.className = "latest-map-button";
        mapButton.textContent = "📍 Auf Karte zeigen";

        mapButton.addEventListener("click", () => {
            showLocationOnMap(location);
        });

        actions.appendChild(mapButton);

        if (isUsableUrl(properties.instagram_url)) {
            actions.appendChild(
                createLatestExternalLink(
                    properties.instagram_url,
                    "📸 Instagram"
                )
            );
        }

        content.append(meta, title, description);

        if (facts.children.length > 0) {
            content.appendChild(facts);
        }

        if (tags.children.length > 0) {
            content.appendChild(tags);
        }

        content.appendChild(actions);
        article.append(imageWrapper, content);

        return article;
    }

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
                        "Keine passenden Orte gefunden. Bitte ändere " +
                        "die Suche oder setze die Filter zurück."
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
            const latitudeLongitude = [latitude, longitude];

            const marker = L.marker(latitudeLongitude, {
                icon: createMarkerIcon(properties.category),
                title: properties.name,
                riseOnHover: true
            });

            marker.bindPopup(createPopup(location), {
                maxWidth: 310,
                minWidth: 250,
                autoPan: true,
                autoPanPadding: [30, 30],
                closeButton: true,
                offset: [0, -18]
            });

            marker.on("popupopen", () => {
                activeLocationSlug = properties.slug;

                if (!isHandlingBrowserHistory) {
                    setLocationUrl(properties.slug, "push");
                }
            });

            marker.on("popupclose", () => {
                window.setTimeout(() => {
                    if (
                        map._popup ||
                        activeLocationSlug !== properties.slug
                    ) {
                        return;
                    }

                    activeLocationSlug = null;

                    if (!isHandlingBrowserHistory) {
                        removeLocationFromUrl("replace");
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
                        className: "location-preview-tooltip",
                        interactive: false,
                        sticky: false
                    }
                );

                marker.on("click", function closePreview() {
                    this.closeTooltip();
                });
            }

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
                padding: [40, 40],
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
                `<div class="emoji-marker ` +
                `${markerData.className}">` +
                `<span aria-hidden="true">${markerData.icon}</span>` +
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

    function createLocationPreview(location) {
        const properties = location.properties;
        const markerData = getCategoryData(properties.category);

        const preview = document.createElement("article");

        preview.className = "marker-hover-card";

        const image = createLocationImage(properties, "");

        image.alt = "";

        const body = document.createElement("div");

        body.className = "marker-hover-body";

        const category = document.createElement("span");

        category.classNa
