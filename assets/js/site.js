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

  /* contact form: pre-select the subject from a link such as /contact/?topic=ai */
  var subject = document.getElementById("c-subject");
  if (subject) {
    var topic = new URLSearchParams(window.location.search).get("topic");
    if (topic) {
      var key = topic.replace(/[^a-z-]/g, "");
      var opt = subject.querySelector("option[data-topic='" + key + "']");
      if (!opt && key === "bid") {
        opt = document.createElement("option");
        opt.value = "Bid Advisor"; opt.textContent = "Bid Advisor"; opt.setAttribute("data-topic", "bid");
        subject.appendChild(opt);
      }
      if (opt) { subject.value = opt.value; }
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
