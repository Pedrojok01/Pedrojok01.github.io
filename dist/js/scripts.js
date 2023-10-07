/*!
 * Start Bootstrap - Resume v7.0.0 (https://github.com/Pedrojok01/Pedrojok01.github.io)
 * Copyright 2013-2023 Pedrojok01
 * Licensed under MIT (https://github.com/Pedrojok01/startbootstrap-resume/blob/master/LICENSE)
 */
(function ($) {
  // Start of use strict

  // Smooth scrolling using jQuery easing
  $('a.js-scroll-trigger[href*="#"]:not([href="#"])').click(function () {
    if (
      location.pathname.replace(/^\//, "") === this.pathname.replace(/^\//, "") &&
      location.hostname === this.hostname
    ) {
      let target = $(this.hash);
      target = target.length ? target : $(`[name=${this.hash.slice(1)}]`);
      if (target.length) {
        $("html, body").animate(
          {
            scrollTop: target.offset().top,
          },
          1000,
          "easeInOutExpo"
        );
        return false;
      }
    }
  });

  // Closes responsive menu when a scroll trigger link is clicked
  $(".js-scroll-trigger").click(() => {
    $(".navbar-collapse").collapse("hide");
  });

  // Activate scrollspy to add active class to navbar items on scroll
  $("body").scrollspy({
    target: "#sideNav",
  });
})(jQuery); // End of use strict
