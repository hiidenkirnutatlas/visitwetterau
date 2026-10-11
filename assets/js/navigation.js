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
        document.getElementById("placesDropdownToggle");

    if (!header || !menuToggle || !siteMenu) {
        return;
    }

    const isSolidHeader =
        header.classList.contains("site-header-solid");

    function updateHeaderState() {
        if (isSolidHeader) {
            header.classList.add("is-scrolled");
            return;
        }

        header.classList.toggle(
            "is-scrolled",
            window.scrollY > 40
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
            !dropdown.classList.contains("is-open");

        dropdown.classList.toggle(
            "is-open",
            isOpen
        );

        dropdownToggle.setAttribute(
            "aria-expanded",
            String(isOpen)
        );
    }

    menuToggle.addEventListener("click", () => {
        const isOpen =
            menuToggle.getAttribute("aria-expanded") !==
            "true";

        setMenuState(isOpen);
    });

    if (dropdownToggle) {
        dropdownToggle.addEventListener(
            "click",
            (event) => {
                event.preventDefault();
                toggleDropdown();
            }
        );
    }

    siteMenu.addEventListener("click", (event) => {
        const link = event.target.closest("a");

        if (!link) {
            return;
        }

        setMenuState(false);
    });

    document.addEventListener("click", (event) => {
        if (
            dropdown &&
            !dropdown.contains(event.target)
        ) {
            closeDropdown();
        }

        if (
            siteMenu.classList.contains("is-open") &&
            !siteMenu.contains(event.target) &&
            !menuToggle.contains(event.target)
        ) {
            setMenuState(false);
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") {
            return;
        }

        setMenuState(false);
        closeDropdown();
        menuToggle.focus();
    });

    window.addEventListener(
        "scroll",
        updateHeaderState,
        {
            passive: true
        }
    );

    window.addEventListener("resize", () => {
        if (window.innerWidth > 820) {
            setMenuState(false);
        }
    });

    updateHeaderState();
}
