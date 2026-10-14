/* Belgrave Consultancy: settings you may want to change without touching the pages. */
window.BELGRAVE_CONFIG = {
  forms: {
    // Contact form service (for example a Formspree endpoint such as https://formspree.io/f/xxxxxxxx).
    // Empty: the form opens a ready-to-send email instead.
    contact: "",

    // MailerLite (account 2320211). "plain" = no follow-up emails (no double opt-in),
    // "followup" = follow-up emails (double opt-in). "download" is shown after signing up.
    scorecard: {
      plain: "https://assets.mailerlite.com/jsonp/2320211/forms/201314750464787763/subscribe",
      followup: "https://assets.mailerlite.com/jsonp/2320211/forms/201314855968310826/subscribe",
      download: "/d/6946fb68ab8a9edb3d/ERP-Implementation-Readiness-Scorecard.pdf"
    },
    costing: {
      plain: "https://assets.mailerlite.com/jsonp/2320211/forms/201314994774607689/subscribe",
      followup: "https://assets.mailerlite.com/jsonp/2320211/forms/201315259154171180/subscribe",
      download: "/d/6946fb68ab8a9edb3d/Project-Costing-Discovery-Checklist.pdf"
    },
    bid: {
      mailerlite: "https://assets.mailerlite.com/jsonp/2320211/forms/201315385104926494/subscribe"
    }
  }
};
