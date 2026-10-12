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

  /* feature switches */
  if (!cfg.showReview) {
    document.querySelectorAll("[data-feature='review']").forEach(function (el) { el.hidden = true; });
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

  /* forms */
  document.querySelectorAll("form[data-form]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var status = form.querySelector(".form-status");
      var hp = form.querySelector(".hp input");
      if (hp && hp.value) { return; }
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var endpoint = (cfg.forms || {})[form.getAttribute("data-form")];
      function say(msg, cls) { if (status) { status.textContent = msg; status.className = "form-status " + cls; } }
      if (!endpoint) { say("This form is not connected yet, so nothing was sent. Please email info@belgraveconsultancy.com.", "err"); return; }
      var btn = form.querySelector("button[type=submit]");
      if (btn) { btn.disabled = true; }
      say("Sending...", "");
      fetch(endpoint, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } })
        .then(function (r) {
          if (!r.ok) { throw new Error("bad status"); }
          form.reset();
          say(form.getAttribute("data-ok") || "Thank you. Your message has been sent.", "ok");
        })
        .catch(function () { say("Something went wrong. Please email info@belgraveconsultancy.com.", "err"); })
        .then(function () { if (btn) { btn.disabled = false; } });
    });
  });

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
      if (total <= 7) { label = "Start with preparation"; msg = "On these three points the groundwork is thin. That is common, and it is the cheapest time to fix it. Begin with how your processes really run and why you are doing this at all."; }
      else if (total <= 11) { label = "Prepare first"; msg = "Some groundwork is in place, with real gaps. Close the lowest-scoring area before you talk to a single vendor."; }
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
