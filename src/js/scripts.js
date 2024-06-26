// Wrap the code in an IIFE to avoid polluting the global namespace
(function ($) {
  "use strict";

  // Constants
  const ANIMATION_DURATION = 1000; // Adjust this value for the desired animation speed

  // Cache the frequently used selectors
  const $scrollTrigger = $('a.js-scroll-trigger[href*="#"]:not([href="#"])');
  const $navbarCollapse = $(".navbar-collapse");

  // Event handler for smooth scrolling and menu collapsing on click
  $scrollTrigger.on("click", function (event) {
    handleSmoothScrolling(event, this);
    handleMenuCollapse();
  });

  // Activate scrollspy to add active class to navbar items on scroll
  $("body").scrollspy({
    target: "#sideNav",
  });

  /**
   * Handles smooth scrolling when a scroll trigger link is clicked.
   * @param {Event} event - The click event.
   * @param {HTMLElement} element - The clicked element.
   */
  function handleSmoothScrolling(event, element) {
    if (
      location.pathname.replace(/^\//, "") ===
        element.pathname.replace(/^\//, "") &&
      location.hostname === element.hostname
    ) {
      const target = $(element.hash);
      const $target = target.length
        ? target
        : $(`[name=${element.hash.slice(1)}]`);

      if ($target.length) {
        event.preventDefault();
        $("html, body").animate(
          {
            scrollTop: $target.offset().top,
          },
          ANIMATION_DURATION,
          "easeInOutExpo",
          () => {
            // Animation complete, update the URL with the anchor
            history.pushState(null, null, element.hash);
          },
        );
      }
    }
  }

  /**
   * Closes the responsive menu.
   */
  function handleMenuCollapse() {
    $navbarCollapse.collapse("hide");
  }
})(jQuery);
