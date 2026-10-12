/* Belgrave Consultancy: settings you may want to change without touching the pages.
   After editing, run:  node build.mjs   (only needed if you change the HTML sources) */
window.BELGRAVE_CONFIG = {

  // Form endpoints. Leave empty until the services are connected (the forms then
  // show a "not connected yet" notice instead of sending anything).
  forms: {
    contact: "",     // e.g. a Formspree endpoint
    scorecard: "",   // MailerLite group: ERP readiness scorecard
    costing: "",     // MailerLite group: project costing checklist
    bid: ""          // MailerLite group: Bid Advisor interest
  }
};
