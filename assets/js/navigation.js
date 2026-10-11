"use strict";

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializeNavigation,
        {
            once: true
        }
    );
} else {
    initializeNavigation();
}

function initializeNavigation() {
    const header =
        document.getElementById("siteHeader");
    const menuToggle =
        document.getElementById("menuToggle");
    const siteMenu =
        document.getElementById("siteMenu");
    const dropdown =
        document.getElementById("placesDropdown");
    const dropdownToggle =
        document.getElementById(
            "placesDropdownToggle"
        );

    if (!header) {
        console.warn(
            "Navigation: #siteHeader wurde nicht gefunden."
        );
        return;
    }

    if (!menuToggle || !siteMenu) {
        console.warn(
            "Navigation: Burger oder Menü wurde nicht gefunden."
        );
        return;
    }

    const isSolidHeader =
        header.classList.contains(
            "site-header-solid"
        );

    function updateHeaderState() {
        const shouldBeSolid =
            isSolidHeader ||
            window.scrollY > 40;

        header.classList.toggle(
            "is-scrolled",
            shouldBeSolid
        );
    }

    function closeDropdown() {
        if (!dropdown || !dropdownToggle) {
            return;
        }

        dropdown.classList.remove("is-open");

        dropdownToggle.setAttribute(
            "aria-expanded",
            "false"
        );
    }

    function toggleDropdown() {
        if (!dropdown || !dropdownToggle) {
            return;
        }

        const isOpen =
            !dropdown.classList.contains(
                "is-open"
            );

        dropdown.classList.toggle(
            "is-open",
            isOpen
        );

        dropdownToggle.setAttribute(
            "aria-expanded",
            String(isOpen)
        );
    }

    function setMenuState(isOpen) {
        menuToggle.classList.toggle(
            "is-open",
            isOpen
        );

        siteMenu.classList.toggle(
            "is-open",
            isOpen
        );

        header.classList.toggle(
            "is-menu-open",
            isOpen
        );

        document.body.classList.toggle(
            "menu-open",
            isOpen
        );

        menuToggle.setAttribute(
            "aria-expanded",
            String(isOpen)
        );

        menuToggle.setAttribute(
            "aria-label",
            isOpen
                ? "Menü schließen"
                : "Menü öffnen"
        );

        if (!isOpen) {
            closeDropdown();
        }
    }

    menuToggle.addEventListener(
        "click",
        (event) => {
            event.preventDefault();
            event.stopPropagation();

            const isOpen =
                menuToggle.getAttribute(
                    "aria-expanded"
                ) !== "true";

            setMenuState(isOpen);
        }
    );

    if (dropdownToggle) {
        dropdownToggle.addEventListener(
            "click",
            (event) => {
                event.preventDefault();
                event.stopPropagation();

                toggleDropdown();
            }
        );
    }

    siteMenu.addEventListener(
        "click",
        (event) => {
            const link =
                event.target.closest("a");

            if (!link) {
                return;
            }

            setMenuState(false);
        }
    );

    document.addEventListener(
        "click",
        (event) => {
            if (
                dropdown &&
                !dropdown.contains(event.target)
            ) {
                closeDropdown();
            }

            if (
                siteMenu.classList.contains(
                    "is-open"
                ) &&
                !siteMenu.contains(event.target) &&
                !menuToggle.contains(event.target)
            ) {
                setMenuState(false);
            }
        }
    );

    document.addEventListener(
        "keydown",
        (event) => {
            if (event.key !== "Escape") {
                return;
            }

            const menuWasOpen =
                siteMenu.classList.contains(
                    "is-open"
                );

            setMenuState(false);
            closeDropdown();

            if (menuWasOpen) {
                menuToggle.focus();
            }
        }
    );

    window.addEventListener(
        "scroll",
        updateHeaderState,
        {
            passive: true
        }
    );

    window.addEventListener(
        "resize",
        () => {
            if (window.innerWidth > 820) {
                setMenuState(false);
            }
        }
    );

    updateHeaderState();
}
