(function () {
  "use strict";
  var cfg = window.BELGRAVE_CONFIG || { showReview: true, forms: {} };
  document.documentElement.classList.remove("no-js");
  document.documentElement.classList.add("js");

  /* mobile navigation */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") { nav.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); }
    });
  }

  /* contact page: the "Write to me" button opens an email with a subject that matches a link such as /contact/?topic=ai */
  var writeBtn = document.getElementById("write-btn");
  if (writeBtn) {
    var subjects = {
      consultancy: "Discuss my business situation", strategy: "Strategy and planning", organisation: "Organisation",
      performance: "Budgets and project performance", coaching: "Management support", erp: "ERP and systems",
      ai: "Practical AI advice", guide: "A question about the ERP guide", bid: "Bid Advisor", other: "Something else"
    };
    var topic = (new URLSearchParams(window.location.search).get("topic") || "").replace(/[^a-z-]/g, "");
    if (subjects[topic]) {
      writeBtn.setAttribute("href", "mailto:info@belgraveconsultancy.com?subject=" + encodeURIComponent(subjects[topic]));
    }
  }

  /* reveal on scroll */
  var items = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && items.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add("in"); });
  }

  /* visitor events: counted by GoatCounter (no cookies); names are defined in the event dictionary */
  function track(name) {
    try { if (window.goatcounter && window.goatcounter.count) { window.goatcounter.count({ path: name, title: name, event: true }); } } catch (e) {}
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest("a") : null;
    if (!a) { return; }
    var h = a.getAttribute("href") || "";
    if (h.indexOf("store.belgraveconsultancy.com/checkout") !== -1) { track("guide-checkout-click"); }
    else if (a.hasAttribute("download")) { track("resource-download"); }
    else if (h.indexOf("wa.me/") !== -1) { track("whatsapp-click"); }
    else if (h.indexOf("mailto:") === 0) { track("email-click"); }
    else if (h.indexOf("contact/?topic=consultancy") !== -1) { track("cta-consultancy-click"); }
    else if (h.indexOf("guide-sample/") !== -1) { track("guide-sample-open"); }
  });
  var started = {};
  document.addEventListener("focusin", function (e) {
    var f = e.target.closest ? e.target.closest("form[data-form]") : null;
    if (!f) { return; }
    var kind = f.getAttribute("data-form");
    if (started[kind]) { return; }
    started[kind] = true;
    track(kind === "contact" ? "contact-form-start" : kind === "bid" ? "bid-form-start" : "resource-form-start");
  });

  /* forms
     - contact: posts to the form service in config (falls back to a ready-to-send email)
     - scorecard, costing: MailerLite. The checkbox picks the form: with follow-up emails (double opt-in)
       or without. On success the visitor gets the download link straight away.
     - bid: MailerLite for the email address; the written answers also go to the contact service if set */
  var MAIL = "info@belgraveconsultancy.com";
  var SUBJECTS = {
    contact: "Enquiry from the website",
    scorecard: "Please send me the ERP readiness scorecard",
    costing: "Please send me the project costing checklist",
    bid: "Bid Advisor interest"
  };
  function mailFallback(form, say) {
    var kind = form.getAttribute("data-form");
    var data = new FormData(form), lines = [];
    var subjectField = data.get("subject");
    data.forEach(function (v, k) {
      if (k === "website" || k === "consent" || !String(v).trim()) { return; }
      lines.push(k + ": " + v);
    });
    var subject = kind === "contact" && subjectField ? String(subjectField) : SUBJECTS[kind] || "Website enquiry";
    window.location.href = "mailto:" + MAIL + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(lines.join("\n"));
    say("Your email app should open with your message ready to send. If it does not, write to " + MAIL + ".", "ok");
  }
  function subscribe(endpoint, email) {
    var body = new FormData();
    body.append("fields[email]", email);
    body.append("ml-submit", "1");
    body.append("anticsrf", "true");
    return fetch(endpoint, { method: "POST", body: body }).then(function (r) {
      if (!r.ok) { throw new Error("status " + r.status); }
      return r.json().catch(function () { return { success: true }; });
    }).then(function (j) {
      if (j && j.success === false) { throw new Error("rejected"); }
      return j;
    });
  }

  document.querySelectorAll("form[data-form]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var kind = form.getAttribute("data-form");
      var status = form.querySelector(".form-status");
      var hp = form.querySelector(".hp input");
      if (hp && hp.value) { return; }
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var conf = (cfg.forms || {})[kind];
      var btn = form.querySelector("button[type=submit]");
      function say(msg, cls) { if (status) { status.textContent = msg; status.className = "form-status " + cls; } }
      function done(msg, link, linkText) {
        form.reset();
        if (!status) { return; }
        status.className = "form-status ok";
        status.textContent = msg + " ";
        if (link) { var a = document.createElement("a"); a.href = link; a.textContent = linkText; a.setAttribute("download", ""); status.appendChild(a); }
      }
      function fail() { say("Something went wrong. Please email " + MAIL + " and I will send it to you.", "err"); }
      function busy(on) { if (btn) { btn.disabled = on; } }

      if (kind === "scorecard" || kind === "costing") {
        var wantsFollowUp = !!(form.querySelector("input[name=followup]") || {}).checked;
        var endpoint = conf && (wantsFollowUp ? conf.followup : conf.plain);
        if (!endpoint) { mailFallback(form, say); return; }
        busy(true); say("Sending...", "");
        subscribe(endpoint, form.querySelector("input[name=email]").value)
          .then(function () {
            var what = kind === "scorecard" ? "scorecard" : "checklist";
            var msg = "Thank you." + (wantsFollowUp ? " A confirmation email is on its way: please click the link in it to receive follow-up emails." : "");
            track("resource-signup-" + (wantsFollowUp ? "updates" : "plain"));
            done(msg, conf.download, "Download the " + what + " (PDF)");
          })
          .catch(fail).then(function () { busy(false); });
        return;
      }

      if (kind === "bid") {
        var ml = conf && conf.mailerlite;
        if (!ml) { mailFallback(form, say); return; }
        busy(true); say("Sending...", "");
        var answers = new FormData(form);
        subscribe(ml, form.querySelector("input[name=email]").value)
          .then(function () {
            var extra = (cfg.forms || {}).contact;
            if (extra && typeof extra === "string") {
              answers.append("subject", "Bid Advisor interest");
              return fetch(extra, { method: "POST", body: answers, headers: { Accept: "application/json" } }).catch(function () {});
            }
          })
          .then(function () { track("bid-interest-sent"); done(form.getAttribute("data-ok") || "Thank you. I have your answer."); })
          .catch(fail).then(function () { busy(false); });
        return;
      }

      /* contact */
      var cEndpoint = typeof conf === "string" ? conf : "";
      if (!cEndpoint) { mailFallback(form, say); return; }
      busy(true); say("Sending...", "");
      fetch(cEndpoint, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } })
        .then(function (r) { if (!r.ok) { throw new Error("bad status"); } track("contact-form-sent"); done(form.getAttribute("data-ok") || "Thank you. Your message has been sent."); })
        .catch(fail).then(function () { busy(false); });
    });
  });

  /* lightbox: enlarge a sample or a page image */
  var triggers = document.querySelectorAll("[data-enlarge],[data-lightbox]");
  if (triggers.length) {
    var dlg = document.createElement("dialog");
    dlg.className = "lightbox";
    dlg.setAttribute("aria-label", "Enlarged sample");
    dlg.innerHTML = '<div class="lightbox-inner"><div class="lightbox-bar"><span class="lightbox-title"></span><button class="lightbox-close" type="button">Close</button></div><div class="lightbox-body"></div></div>';
    document.body.appendChild(dlg);
    var body = dlg.querySelector(".lightbox-body");
    var ttl = dlg.querySelector(".lightbox-title");
    var close = function () { if (dlg.open) { dlg.close(); } };
    dlg.querySelector(".lightbox-close").addEventListener("click", close);
    dlg.addEventListener("click", function (e) { if (e.target === dlg) { close(); } });
    triggers.forEach(function (t) {
      t.addEventListener("click", function () {
        body.innerHTML = "";
        var hint = t.getAttribute("data-hint");
        if (hint) { var hp = document.createElement("p"); hp.className = "swipe-hint"; hp.textContent = hint; body.appendChild(hp); }
        ttl.textContent = t.getAttribute("data-title") || "";
        dlg.setAttribute("aria-label", t.getAttribute("data-title") || "Enlarged sample");
        var src = t.getAttribute("data-lightbox");
        if (src) {
          var img = new Image();
          img.src = src; img.alt = t.getAttribute("data-alt") || "";
          body.appendChild(img);
        } else {
          var node = document.querySelector(t.getAttribute("data-enlarge"));
          if (!node) { return; }
          var copy = node.cloneNode(true);
          copy.querySelectorAll("[id]").forEach(function (el) { el.removeAttribute("id"); });
          body.appendChild(copy);
        }
        if (typeof dlg.showModal === "function") { dlg.showModal(); }
      });
    });
  }

  /* three-question readiness check */
  var check = document.getElementById("minicheck");
  if (check) {
    var result = document.getElementById("minicheck-result");
    check.addEventListener("submit", function (e) {
      e.preventDefault();
      var names = ["q1", "q2", "q3"], total = 0;
      for (var i = 0; i < names.length; i++) {
        var chosen = check.querySelector("input[name=" + names[i] + "]:checked");
        if (!chosen) { check.querySelector("input[name=" + names[i] + "]").focus(); result.hidden = false; result.querySelector(".msg").textContent = "Please answer all three questions."; result.querySelector(".score").textContent = ""; return; }
        total += parseInt(chosen.value, 10);
      }
      var msg, label;
      if (total <= 7) { label = "Start with preparation"; msg = "These answers suggest that some foundations need attention. Start by clarifying how the work runs, what the ERP needs to improve and who will lead the preparation."; }
      else if (total <= 11) { label = "Prepare first"; msg = "Some foundations are in place. Review the lowest-scoring area with your team before committing to a system or implementation plan."; }
      else { label = "Looking solid"; msg = "These three foundations look strong. The full scorecard tests the other four: internal capacity, data quality, budget realism and change readiness."; }
      result.hidden = false;
      result.querySelector(".score").innerHTML = total + "<small> / 15</small>";
      result.querySelector(".label").textContent = label;
      result.querySelector(".msg").textContent = msg;
      result.querySelector(".meter i").style.width = Math.round(((total - 3) / 12) * 100) + "%";
      result.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }
})();
