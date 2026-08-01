/* ============================================================
   Kiana Lee — the estimate engine.

   One place that knows how to turn a set of choices into money,
   shared by the estimator (pricing.js) and the booking flow
   (booking.js) so the two can never disagree. Also owns the
   handoff between them: the estimate you build on the pricing
   page rides along to the calendar.

   Depends on assets/data/pricing.js only.
   ============================================================ */

window.KL = (function () {
  "use strict";

  const P = window.KL_PRICING;
  const STORE = "kl-estimate";

  /* ---------------- small helpers ---------------- */

  const byId = (list, id) => list.find((x) => x.id === id) || list[0];

  function money(n) {
    return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function moneyShort(n) {
    return "$" + Math.round(n).toLocaleString("en-US");
  }

  /* half-hour units -> "1 HR 30" */
  function hoursLabel(halfHours, lower) {
    const h = Math.floor(halfHours / 2);
    const m = (halfHours % 2) * 30;
    const parts = [];
    if (h) parts.push(h + (lower ? (h === 1 ? " hr" : " hrs") : " HR" + (h === 1 ? "" : "S")));
    if (m) parts.push(m + (lower ? " min" : " MIN"));
    return parts.join(" ") || (lower ? "0 min" : "0 MIN");
  }

  /* ---------------- state ---------------- */

  function defaults(sessionId) {
    const s = sessionId ? byId(P.sessions, sessionId) : P.sessions[0];
    return {
      session: s.id,
      halfHours: Math.round(s.minHours * 2),
      rolls: s.rolls,
      stock: P.stocks[0].id,
      addons: { editing: true, negatives: false, ultra: false, rush: false },
      prints: {},
      travel: P.travel[0].id,
    };
  }

  /* Re-seed the parts of the state that belong to a session type,
     keeping anything the visitor has deliberately changed. */
  function applySession(state, sessionId, touched) {
    const s = byId(P.sessions, sessionId);
    state.session = s.id;
    const min = Math.round(s.minHours * 2);
    if (!touched || !touched.halfHours || state.halfHours < min) state.halfHours = min;
    if (!touched || !touched.rolls) state.rolls = s.rolls;
    return state;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || typeof s !== "object") return null;
      /* trust nothing that came out of storage: every id goes back
         through byId, which falls back to the first valid option */
      const base = defaults(s.session);
      return {
        session: byId(P.sessions, s.session).id,
        halfHours: clampHalfHours(s.session, +s.halfHours || base.halfHours),
        rolls: Math.min(12, Math.max(1, +s.rolls || base.rolls)),
        stock: byId(P.stocks, s.stock).id,
        addons: Object.assign({}, base.addons, s.addons || {}),
        prints: s.prints && typeof s.prints === "object" ? s.prints : {},
        travel: byId(P.travel, s.travel).id,
      };
    } catch (err) {
      return null;
    }
  }

  function save(state) {
    try {
      localStorage.setItem(STORE, JSON.stringify(state));
    } catch (err) {
      /* private mode, quota, whatever — the page still works */
    }
  }

  function clampHalfHours(sessionId, halfHours) {
    const min = Math.round(byId(P.sessions, sessionId).minHours * 2);
    return Math.min(24, Math.max(min, halfHours));
  }

  /* ---------------- the maths ---------------- */

  function compute(state) {
    const session = byId(P.sessions, state.session);
    const stock = byId(P.stocks, state.stock);
    const travel = byId(P.travel, state.travel);
    const rate = session.hourly || P.hourly;
    const hours = state.halfHours / 2;
    const rolls = state.rolls;
    const items = [];

    const add = (label, detail, amount) => {
      if (amount > 0) items.push({ label, detail, amount });
    };

    add("Time on location", hoursLabel(state.halfHours, true), hours * rate);

    add(
      "Film",
      stock.name + " × " + rolls + (rolls === 1 ? " roll" : " rolls"),
      rolls * stock.roll
    );

    add(
      "Develop + scan",
      (state.addons.ultra ? "4000dpi ultra-res" : "2000dpi high-res") +
        " × " + rolls + (rolls === 1 ? " roll" : " rolls"),
      rolls * (P.lab.developScan + (state.addons.ultra ? P.lab.ultraScan : 0))
    );

    if (state.addons.editing) {
      add("Hand-edited selects", "every keeper, by eye × " + rolls, rolls * P.lab.editing);
    }
    if (state.addons.negatives) {
      add("Your negatives back", "sleeved and numbered × " + rolls, rolls * P.lab.negatives);
    }
    if (state.addons.rush) {
      add("Rush the lab", "next day instead of a week", P.lab.rush);
    }

    P.prints.forEach((p) => {
      const qty = +state.prints[p.id] || 0;
      if (qty > 0) add(p.name, p.unit + " × " + qty, qty * p.price);
    });

    if (travel.price > 0) add("Travel", travel.name, travel.price);

    const total = items.reduce((sum, i) => sum + i.amount, 0);

    const d = P.deposit;
    let deposit = Math.round((total * d.pct) / d.roundTo) * d.roundTo;
    deposit = Math.min(d.max, Math.max(d.min, deposit));
    if (total === 0) deposit = 0;

    return {
      items,
      total,
      deposit,
      hours,
      rate,
      rolls,
      session,
      stock,
      travel,
      quoteOnly: !!travel.quote || !!session.quoteOnly,
    };
  }

  /* A stable little order number, so the slip feels like a real
     docket rather than a calculator readout. */
  function slipNumber(state) {
    const key = [state.session, state.halfHours, state.rolls, state.stock, state.travel]
      .join("|") + JSON.stringify(state.addons) + JSON.stringify(state.prints);
    let h = 7;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 9973;
    return "No. " + String(h % 9000 + 1000);
  }

  /* ---------------- slip rendering ---------------- */

  /* Fills a .slip-body with what's on the order. Deliberately no
     per-line prices: the slip says what you're getting, and the total
     at the bottom says what it comes to. */
  function renderSlipBody(el, calc) {
    el.textContent = "";
    if (!calc.items.length) {
      const empty = document.createElement("p");
      empty.className = "slip-empty";
      empty.textContent = "Nothing on the docket yet.";
      el.appendChild(empty);
      return;
    }
    calc.items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "slip-row";

      const label = document.createElement("p");
      label.className = "slip-line";
      label.textContent = item.label;

      const detail = document.createElement("p");
      detail.className = "slip-detail";
      detail.textContent = item.detail;

      row.append(label, detail);
      el.appendChild(row);
    });
  }

  /* Counts the total up rather than snapping it, when GSAP is around
     and the visitor hasn't asked for less motion. */
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const counters = new WeakMap();

  function setTotal(el, value) {
    if (!el) return;
    const from = counters.get(el) || 0;
    counters.set(el, value);
    if (reduced || typeof gsap === "undefined" || Math.abs(value - from) < 0.01) {
      el.textContent = money(value);
      return;
    }
    const proxy = { n: from };
    gsap.to(proxy, {
      n: value,
      duration: 0.5,
      ease: "power2.out",
      overwrite: true,
      onUpdate: () => (el.textContent = money(proxy.n)),
      onComplete: () => (el.textContent = money(value)),
    });
  }

  /* ---------------- plain-language summary ---------------- */

  /* Used in the booking email and the booking page's slip header. */
  function summary(state) {
    const c = compute(state);
    const bits = [
      c.session.name,
      hoursLabel(state.halfHours, true),
      c.rolls + (c.rolls === 1 ? " roll of " : " rolls of ") + c.stock.name,
    ];
    if (state.addons.editing) bits.push("hand-edited");
    if (state.addons.negatives) bits.push("negatives returned");
    if (state.addons.ultra) bits.push("4000dpi scans");
    if (state.addons.rush) bits.push("rush lab");
    P.prints.forEach((p) => {
      const qty = +state.prints[p.id] || 0;
      if (qty > 0) bits.push(qty + "× " + p.name + " (" + p.unit + ")");
    });
    if (c.travel.price > 0 || c.travel.quote) bits.push("travel: " + c.travel.name);
    return bits.join(", ");
  }

  return {
    P,
    byId,
    money,
    moneyShort,
    hoursLabel,
    defaults,
    applySession,
    clampHalfHours,
    load,
    save,
    compute,
    slipNumber,
    renderSlipBody,
    setTotal,
    summary,
    reduced,
  };
})();
