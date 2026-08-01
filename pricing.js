/* ============================================================
   Kiana Lee — the estimator (pricing.html only).

   Builds every control from assets/data/pricing.js, so changing a
   price or adding a session type never means touching markup.
   State lives in KL (estimate.js) and is saved as you go, which
   is what the booking page picks up.
   ============================================================ */

(function () {
  "use strict";

  const grid = document.getElementById("type-grid");
  if (!grid || !window.KL) return;

  const P = KL.P;
  const state = KL.load() || KL.defaults();
  /* what the visitor has changed by hand, so switching session type
     doesn't stomp on a deliberate choice */
  const touched = { halfHours: false, rolls: false };

  const el = {
    typeNote: document.getElementById("type-note"),
    hours: document.getElementById("hours"),
    hoursRead: document.getElementById("hours-read"),
    hoursScale: document.getElementById("hours-scale"),
    hoursNote: document.getElementById("hours-note"),
    rollsVal: document.getElementById("rolls-val"),
    canisters: document.getElementById("canisters"),
    rollsNote: document.getElementById("rolls-note"),
    stocks: document.getElementById("stock-list"),
    included: document.getElementById("included"),
    addons: document.getElementById("addons"),
    prints: document.getElementById("prints"),
    travel: document.getElementById("travel"),
    slipBody: document.getElementById("slip-body"),
    slipTotal: document.getElementById("slip-total"),
    slipDeposit: document.getElementById("slip-deposit"),
    slipNo: document.getElementById("slip-no"),
    slipQuote: document.getElementById("slip-quote"),
    ledger: document.getElementById("ledger"),
    barTotal: document.getElementById("est-bar-total"),
    slipStatus: document.getElementById("slip-status"),
  };

  const MAX_HALF_HOURS = 24; // eight hours is plenty for one roll bag

  /* ---------------- little builders ---------------- */

  function choiceCard(opts) {
    const label = document.createElement("label");
    label.className = opts.className;
    label.setAttribute("data-cursor", "go");

    const input = document.createElement("input");
    input.type = "radio";
    input.name = opts.name;
    input.value = opts.value;
    input.className = "vis-hidden";
    input.checked = opts.checked;
    input.addEventListener("change", opts.onChange);
    label.appendChild(input);
    return { label, input };
  }

  function markBox() {
    const box = document.createElement("span");
    box.className = "mark-box";
    box.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M4 4 L20 20" /><path d="M20 4 L4 20" /></svg>';
    return box;
  }

  function stepper(label, onStep, readEl) {
    const wrap = document.createElement("div");
    wrap.className = "stepper stepper--sm";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", label);

    const minus = document.createElement("button");
    minus.type = "button";
    minus.className = "stepper-btn";
    minus.textContent = "−";
    minus.setAttribute("aria-label", "One fewer " + label);
    minus.addEventListener("click", () => onStep(-1));

    const plus = document.createElement("button");
    plus.type = "button";
    plus.className = "stepper-btn";
    plus.textContent = "+";
    plus.setAttribute("aria-label", "One more " + label);
    plus.addEventListener("click", () => onStep(1));

    readEl.className = "stepper-val stepper-val--sm";
    readEl.setAttribute("aria-live", "polite");
    wrap.append(minus, readEl, plus);
    return wrap;
  }

  /* ---------------- 01 · session type ---------------- */

  P.sessions.forEach((s) => {
    const { label, input } = choiceCard({
      className: "type-card",
      name: "session",
      value: s.id,
      checked: s.id === state.session,
      onChange: () => {
        KL.applySession(state, s.id, touched);
        syncAll();
      },
    });

    const name = document.createElement("span");
    name.className = "type-name";
    name.textContent = s.name;

    const blurb = document.createElement("span");
    blurb.className = "type-blurb";
    blurb.textContent = s.blurb;

    const meta = document.createElement("span");
    meta.className = "type-meta mono";
    meta.textContent =
      "from " + KL.hoursLabel(Math.round(s.minHours * 2), true) +
      " · " + KL.moneyShort(s.hourly || P.hourly) + "/hr";

    const marks = document.createElement("span");
    marks.className = "marks";
    marks.setAttribute("aria-hidden", "true");

    label.append(name, blurb, meta, marks);
    grid.appendChild(label);
    input.dataset.role = "session";
  });

  /* ---------------- 03 · film stock ---------------- */

  P.stocks.forEach((s) => {
    const { label } = choiceCard({
      className: "stock",
      name: "stock",
      value: s.id,
      checked: s.id === state.stock,
      onChange: () => {
        state.stock = s.id;
        syncAll();
      },
    });

    const dot = document.createElement("span");
    dot.className = "stock-dot";
    dot.setAttribute("aria-hidden", "true");

    const text = document.createElement("span");
    text.className = "stock-text";
    const name = document.createElement("span");
    name.className = "stock-name";
    name.textContent = s.name;
    const blurb = document.createElement("span");
    blurb.className = "stock-blurb";
    blurb.textContent = s.blurb;
    text.append(name, blurb);

    const price = document.createElement("span");
    price.className = "stock-price mono";
    price.textContent = KL.moneyShort(s.roll) + " / roll";

    label.append(dot, text, price);
    el.stocks.appendChild(label);
  });

  /* ---------------- 04 · what you get back ---------------- */

  P.included.forEach((line) => {
    const li = document.createElement("li");
    li.textContent = line;
    el.included.appendChild(li);
  });

  const ADDONS = [
    {
      key: "editing",
      name: "Hand-edited selects",
      blurb: "Dust, colour and horizon fixed on every keeper. Not a preset.",
      price: () => P.lab.editing,
      per: "roll",
    },
    {
      key: "negatives",
      name: "Keep the negatives",
      blurb: "The actual film back, sleeved and numbered, once it's scanned.",
      price: () => P.lab.negatives,
      per: "roll",
    },
    {
      key: "ultra",
      name: "Ultra-res scans",
      blurb: "4000dpi instead of 2000. Worth it if you'll print big.",
      price: () => P.lab.ultraScan,
      per: "roll",
    },
    {
      key: "rush",
      name: "Rush the lab",
      blurb: "Next day instead of about a week. Costs what the lab charges.",
      price: () => P.lab.rush,
      per: "order",
    },
  ];

  ADDONS.forEach((a) => {
    const label = document.createElement("label");
    label.className = "mark-row";
    label.setAttribute("data-cursor", "go");

    const input = document.createElement("input");
    input.type = "checkbox";
    input.className = "vis-hidden";
    input.checked = !!state.addons[a.key];
    input.addEventListener("change", () => {
      state.addons[a.key] = input.checked;
      syncAll();
    });

    const text = document.createElement("span");
    text.className = "mark-text";
    const name = document.createElement("span");
    name.className = "mark-name";
    name.textContent = a.name;
    const blurb = document.createElement("span");
    blurb.className = "mark-blurb";
    blurb.textContent = a.blurb;
    text.append(name, blurb);

    const price = document.createElement("span");
    price.className = "mark-price mono";
    price.textContent = "+" + KL.moneyShort(a.price()) + " / " + a.per;

    label.append(input, markBox(), text, price);
    el.addons.appendChild(label);
  });

  /* prints */
  P.prints.forEach((p) => {
    const row = document.createElement("div");
    row.className = "print-row";

    const text = document.createElement("span");
    text.className = "mark-text";
    const name = document.createElement("span");
    name.className = "mark-name";
    name.textContent = p.name;
    const blurb = document.createElement("span");
    blurb.className = "mark-blurb";
    blurb.textContent = p.unit + " · " + KL.moneyShort(p.price);
    text.append(name, blurb);

    const read = document.createElement("span");
    const step = stepper(p.name, (dir) => {
      const next = Math.min(p.max, Math.max(0, (+state.prints[p.id] || 0) + dir));
      state.prints[p.id] = next;
      syncAll();
    }, read);
    step.dataset.print = p.id;

    row.append(text, step);
    el.prints.appendChild(row);
  });

  /* ---------------- 05 · travel ---------------- */

  P.travel.forEach((t) => {
    const { label } = choiceCard({
      className: "pill",
      name: "travel",
      value: t.id,
      checked: t.id === state.travel,
      onChange: () => {
        state.travel = t.id;
        syncAll();
      },
    });

    const name = document.createElement("span");
    name.textContent = t.name;
    const price = document.createElement("span");
    price.className = "pill-price mono";
    price.textContent = t.quote ? "let's talk" : t.price ? "+" + KL.moneyShort(t.price) : "included";

    label.append(name, price);
    el.travel.appendChild(label);
  });

  /* ---------------- the ledger ---------------- */

  P.sources.forEach((row) => {
    const line = document.createElement("div");
    line.className = "ledger-row";
    row.forEach((cell, i) => {
      const span = document.createElement("span");
      span.className = "ledger-cell ledger-cell--" + i;
      span.textContent = cell;
      line.appendChild(span);
    });
    el.ledger.appendChild(line);
  });

  /* ---------------- hours dial ---------------- */

  el.hours.addEventListener("input", () => {
    touched.halfHours = true;
    state.halfHours = +el.hours.value;
    syncAll();
  });

  function buildScale(min, max) {
    el.hoursScale.textContent = "";
    for (let v = min; v <= max; v++) {
      const tick = document.createElement("span");
      const whole = v % 2 === 0;
      tick.className = "tick" + (whole ? " tick--major" : "");
      tick.style.left = ((v - min) / (max - min)) * 100 + "%";
      if (whole) tick.dataset.label = v / 2;
      el.hoursScale.appendChild(tick);
    }
  }

  /* ---------------- rolls ---------------- */

  document.querySelectorAll("[data-roll]").forEach((btn) => {
    btn.addEventListener("click", () => {
      touched.rolls = true;
      state.rolls = Math.min(12, Math.max(1, state.rolls + +btn.dataset.roll));
      syncAll();
    });
  });

  const CANISTER =
    '<svg class="canister" viewBox="0 0 20 30" aria-hidden="true">' +
    '<rect x="3.5" y="7.5" width="13" height="19" rx="2"/>' +
    '<rect x="7.5" y="2.5" width="5" height="5" rx="1"/>' +
    '<path d="M6 12h8M6 16h8M6 20h5"/></svg>';

  function drawCanisters(n) {
    const have = el.canisters.children.length;
    if (have === n) return;
    el.canisters.textContent = "";
    for (let i = 0; i < n; i++) {
      const span = document.createElement("span");
      span.innerHTML = CANISTER;
      el.canisters.appendChild(span.firstChild);
    }
    if (!KL.reduced && typeof gsap !== "undefined" && n > have) {
      gsap.from(el.canisters.children[n - 1], { autoAlpha: 0, y: -8, duration: 0.4, ease: "power3.out" });
    }
  }

  /* ---------------- sync ---------------- */

  function syncAll() {
    const session = KL.byId(P.sessions, state.session);
    const minHalf = Math.round(session.minHours * 2);

    /* session cards */
    grid.querySelectorAll("input").forEach((input) => {
      const on = input.value === state.session;
      input.checked = on;
      input.closest(".type-card").classList.toggle("is-on", on);
    });
    el.typeNote.textContent = session.note || "";
    el.typeNote.hidden = !session.note;

    /* hours */
    state.halfHours = KL.clampHalfHours(state.session, state.halfHours);
    el.hours.min = minHalf;
    el.hours.max = MAX_HALF_HOURS;
    el.hours.value = state.halfHours;
    el.hours.style.setProperty(
      "--fill",
      ((state.halfHours - minHalf) / (MAX_HALF_HOURS - minHalf)) * 100 + "%"
    );
    el.hoursRead.textContent = KL.hoursLabel(state.halfHours);
    buildScale(minHalf, MAX_HALF_HOURS);
    el.hoursNote.textContent =
      session.name + " starts at " + KL.hoursLabel(minHalf, true) +
      ". Travel between spots counts.";

    /* rolls */
    el.rollsVal.textContent = state.rolls;
    drawCanisters(state.rolls);
    el.rollsNote.textContent =
      state.rolls * 36 + " frames. She usually comes back with " +
      Math.round(state.rolls * 12) + " or so keepers.";

    /* stocks */
    el.stocks.querySelectorAll("input").forEach((input) => {
      const on = input.value === state.stock;
      input.checked = on;
      input.closest(".stock").classList.toggle("is-on", on);
    });

    /* addons */
    el.addons.querySelectorAll(".mark-row").forEach((row, i) => {
      const on = !!state.addons[ADDONS[i].key];
      row.querySelector("input").checked = on;
      row.classList.toggle("is-on", on);
    });

    /* prints */
    el.prints.querySelectorAll("[data-print]").forEach((step) => {
      const qty = +state.prints[step.dataset.print] || 0;
      step.querySelector(".stepper-val").textContent = qty;
      step.closest(".print-row").classList.toggle("is-on", qty > 0);
    });

    /* travel */
    el.travel.querySelectorAll("input").forEach((input) => {
      const on = input.value === state.travel;
      input.checked = on;
      input.closest(".pill").classList.toggle("is-on", on);
    });

    /* the slip */
    const calc = KL.compute(state);
    KL.renderSlipBody(el.slipBody, calc);
    KL.setTotal(el.slipTotal, calc.total);
    KL.setTotal(el.barTotal, calc.total);
    el.slipDeposit.textContent = KL.moneyShort(calc.deposit);
    /* one calm announcement instead of re-reading the whole docket */
    el.slipStatus.textContent =
      "Estimate " + KL.money(calc.total) + ", deposit " + KL.moneyShort(calc.deposit) + ".";
    el.slipNo.textContent = KL.slipNumber(state);
    el.slipQuote.hidden = !calc.quoteOnly;
    if (calc.quoteOnly) {
      el.slipQuote.textContent =
        "A trip that far gets quoted by hand — gas, time and a night away aren't on this slip yet.";
    }

    KL.save(state);
  }

  syncAll();
})();
