/* ============================================================
   Kiana Lee — the booking flow (booking.html only).

   Five blocks down the page rather than a wizard: the session,
   the day, the start time, you, and the deposit. Later blocks
   stay dimmed until the earlier ones make sense, and the slip on
   the right fills in as you go.

   Works with no backend at all: availability comes from
   assets/data/availability.js and the request leaves as a
   prefilled email. If api/availability and api/book are
   deployed, it uses those instead — see BOOKING.md.

   Depends on estimate.js, schedule.js and the two data files.
   ============================================================ */

(function () {
  "use strict";

  const grid = document.getElementById("cal-grid");
  if (!grid || !window.KL || !window.KLSchedule) return;

  const P = KL.P;
  const S = KLSchedule;

  const state = KL.load() || KL.defaults();
  const pick = { date: null, slot: null, pay: "card" };
  let viewMonth = null; // ISO of the 1st of the month on screen
  let sent = false;

  const el = {};
  [
    "session-chips", "session-note", "hours", "hours-read", "hours-scale",
    "cal-month", "cal-prev", "cal-next", "cal-note",
    "block-time", "slots", "slot-wait", "sun-note",
    "block-you", "block-pay", "booking-form", "book-submit", "form-note",
    "pay-grid", "pay-amount", "pay-actions",
    "done", "done-when", "done-copy", "done-fine",
    "slip-when", "slip-body", "slip-total", "slip-deposit", "slip-no", "slip-status",
    "book-bar", "book-bar-when", "book-bar-total",
  ].forEach((id) => (el[id] = document.getElementById(id)));

  const MAX_HALF_HOURS = 24;
  const minutes = () => state.halfHours * 30;

  /* ---------------- 01 · the session ---------------- */

  P.sessions.forEach((s) => {
    const label = document.createElement("label");
    label.className = "chip";
    label.setAttribute("data-cursor", "go");

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "session";
    input.value = s.id;
    input.className = "vis-hidden";
    input.checked = s.id === state.session;
    input.addEventListener("change", () => {
      KL.applySession(state, s.id, { halfHours: false, rolls: true });
      revalidate();
      syncAll();
    });

    const name = document.createElement("span");
    name.textContent = s.name;
    const min = document.createElement("span");
    min.className = "chip-min mono";
    min.textContent = "from " + KL.hoursLabel(Math.round(s.minHours * 2), true);

    label.append(input, name, min);
    el["session-chips"].appendChild(label);
  });

  el.hours.addEventListener("input", () => {
    state.halfHours = +el.hours.value;
    revalidate();
    syncAll();
  });

  function buildScale(min, max) {
    el["hours-scale"].textContent = "";
    for (let v = min; v <= max; v++) {
      const tick = document.createElement("span");
      const whole = v % 2 === 0;
      tick.className = "tick" + (whole ? " tick--major" : "");
      tick.style.left = ((v - min) / (max - min)) * 100 + "%";
      if (whole) tick.dataset.label = v / 2;
      el["hours-scale"].appendChild(tick);
    }
  }

  /* ---------------- 02 · the calendar ---------------- */

  const DOWS = ["S", "M", "T", "W", "T", "F", "S"];
  const dowRow = document.querySelector(".cal-dows");
  DOWS.forEach((d, i) => {
    const span = document.createElement("span");
    span.textContent = d;
    span.title = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][i];
    dowRow.appendChild(span);
  });

  const firstOfMonth = (isoDate) => isoDate.slice(0, 8) + "01";

  function shiftMonth(isoDate, n) {
    const [y, m] = isoDate.split("-").map(Number);
    const t = (y * 12 + (m - 1)) + n;
    return String(Math.floor(t / 12)).padStart(4, "0") + "-" + String((t % 12) + 1).padStart(2, "0") + "-01";
  }

  el["cal-prev"].addEventListener("click", () => {
    viewMonth = shiftMonth(viewMonth, -1);
    renderCalendar();
  });
  el["cal-next"].addEventListener("click", () => {
    viewMonth = shiftMonth(viewMonth, 1);
    renderCalendar();
  });

  function renderCalendar() {
    const dur = minutes();
    const monthStart = viewMonth;
    const nextStart = shiftMonth(viewMonth, 1);
    const lead = S.firstBookable();
    const horizon = S.lastBookable();

    el["cal-month"].textContent = S.monthLabel(monthStart);
    el["cal-prev"].disabled = monthStart <= firstOfMonth(lead);
    el["cal-next"].disabled = monthStart >= firstOfMonth(horizon);

    grid.textContent = "";

    for (let i = 0; i < S.dow(monthStart); i++) {
      const blank = document.createElement("span");
      blank.className = "day day--blank";
      blank.setAttribute("aria-hidden", "true");
      grid.appendChild(blank);
    }

    let open = 0;
    for (let d = monthStart; d < nextStart; d = S.addDays(d, 1)) {
      const info = S.dayState(d, dur);
      if (info.state === "open") open += 1;

      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "day is-" + info.state;
      cell.dataset.date = d;
      cell.disabled = info.state !== "open";

      const no = document.createElement("span");
      no.className = "day-no";
      no.textContent = +d.slice(8);

      const tag = document.createElement("span");
      tag.className = "day-tag mono";
      tag.textContent = info.state === "open" ? info.slots : "";

      cell.append(no, tag);

      cell.setAttribute(
        "aria-label",
        S.longDate(d) + " — " + {
          open: info.slots + (info.slots === 1 ? " start time free" : " start times free"),
          taken: "already booked",
          closed: "not shooting",
          soon: "too soon to book",
          past: "in the past",
        }[info.state]
      );

      if (d === pick.date) cell.classList.add("is-sel");
      if (info.state === "open") {
        cell.addEventListener("click", () => selectDate(d));
        cell.setAttribute("data-cursor", "go");
      }

      grid.appendChild(cell);
    }

    el["cal-note"].textContent =
      KL.hoursLabel(state.halfHours, true) + " · " +
      (open
        ? open + (open === 1 ? " day open this month." : " days open this month.")
        : "nothing open this month, try the next one.");

    if (!KL.reduced && typeof gsap !== "undefined") {
      gsap.fromTo(
        grid.querySelectorAll(".day:not(.day--blank)"),
        { autoAlpha: 0, y: 6 },
        { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.008, ease: "power2.out", overwrite: true }
      );
    }
  }

  /* ---------------- 03 · the start time ---------------- */

  function selectDate(d) {
    pick.date = d;
    pick.slot = null;
    renderCalendar();
    syncAll();
    scrollTo(el["block-time"]);
  }

  function renderSlots() {
    el.slots.textContent = "";
    if (!pick.date) {
      el["block-time"].classList.add("is-waiting");
      el["slot-wait"].hidden = false;
      el["sun-note"].textContent = "";
      return;
    }

    el["block-time"].classList.remove("is-waiting");
    el["slot-wait"].hidden = true;

    const list = S.slotsFor(pick.date, minutes());
    list.forEach((slot) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "slot" + (slot.golden ? " is-golden" : "");
      btn.dataset.start = slot.start;
      btn.setAttribute("data-cursor", "go");
      if (slot.start === pick.slot) btn.classList.add("is-sel");

      const time = document.createElement("span");
      time.className = "slot-time";
      time.textContent = slot.label;

      const till = document.createElement("span");
      till.className = "slot-till mono";
      till.textContent = "till " + slot.endLabel;

      btn.append(time, till);
      btn.setAttribute(
        "aria-label",
        slot.label + " to " + slot.endLabel + (slot.golden ? ", catches golden hour" : "")
      );

      btn.addEventListener("click", () => {
        pick.slot = slot.start;
        syncAll();
        scrollTo(el["block-you"]);
      });

      el.slots.appendChild(btn);
    });

    const golden = S.goldenWindow(pick.date);
    const anyGolden = list.some((s) => s.golden);
    el["sun-note"].textContent = golden
      ? "Sun sets at " + S.clockLabel(golden.sunset) + " that day." +
        (anyGolden ? " Starred slots run into the last of the light." : "")
      : "";

    if (!KL.reduced && typeof gsap !== "undefined") {
      gsap.fromTo(
        el.slots.children,
        { autoAlpha: 0, y: 8 },
        { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.02, ease: "power2.out", overwrite: true }
      );
    }
  }

  /* a date or a length can stop working when the other one changes */
  function revalidate() {
    if (!pick.date) return;
    const list = S.slotsFor(pick.date, minutes());
    if (!list.length) {
      pick.date = null;
      pick.slot = null;
      return;
    }
    if (pick.slot != null && !list.some((s) => s.start === pick.slot)) pick.slot = null;
  }

  /* ---------------- 05 · the deposit ---------------- */

  const PAY = [
    {
      id: "card",
      name: "Card",
      blurb: "Visa, Mastercard, Amex or Apple Pay. Stripe handles it — card details never reach this site.",
    },
    {
      id: "venmo",
      name: "Venmo",
      blurb: "Straight to @" + P.venmo + ", with the date already in the note.",
    },
    {
      id: "later",
      name: "After she confirms",
      blurb: "Send the request now and sort the deposit once she's replied.",
    },
  ];

  PAY.forEach((m) => {
    const label = document.createElement("label");
    label.className = "pay-card";
    label.setAttribute("data-cursor", "go");

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "pay";
    input.value = m.id;
    input.className = "vis-hidden";
    input.checked = m.id === pick.pay;
    input.addEventListener("change", () => {
      pick.pay = m.id;
      syncAll();
    });

    const name = document.createElement("span");
    name.className = "pay-name";
    name.textContent = m.name;
    const blurb = document.createElement("span");
    blurb.className = "pay-blurb";
    blurb.textContent = m.blurb;

    label.append(input, name, blurb);
    el["pay-grid"].appendChild(label);
  });

  /* ---------------- payment links ---------------- */

  function reference() {
    return KL.slipNumber(state).replace(/\D/g, "") + "-" + (pick.date || "").replace(/-/g, "");
  }

  function payNote() {
    return "Deposit · " + KL.byId(P.sessions, state.session).name + " · " +
      S.shortDate(pick.date) + ", " + S.clockLabel(pick.slot);
  }

  function venmoUrl(amount) {
    return "https://venmo.com/?txn=pay&audience=private" +
      "&recipients=" + encodeURIComponent(P.venmo) +
      "&amount=" + encodeURIComponent(amount) +
      "&note=" + encodeURIComponent(payNote());
  }

  function stripeUrl(email) {
    if (!P.stripeLink) return null;
    const join = P.stripeLink.indexOf("?") === -1 ? "?" : "&";
    return P.stripeLink + join +
      "prefilled_email=" + encodeURIComponent(email) +
      "&client_reference_id=" + encodeURIComponent(reference());
  }

  /* ---------------- submit ---------------- */

  el["booking-form"].addEventListener("submit", (e) => {
    e.preventDefault();
    if (sent) return;

    const f = new FormData(el["booking-form"]);
    const name = (f.get("name") || "").trim();
    const email = (f.get("email") || "").trim();

    const problems = [];
    if (!pick.date || pick.slot == null) problems.push("pick a day and a start time");
    if (!name) problems.push("add your name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.push("check your email address");

    if (problems.length) {
      el["form-note"].textContent = "Before this can send: " + problems.join(", ") + ".";
      el["form-note"].classList.add("is-bad");
      const target = !pick.date || pick.slot == null ? el["block-time"] : el["block-you"];
      scrollTo(target);
      return;
    }

    el["form-note"].classList.remove("is-bad");
    el["form-note"].textContent = "Sending…";
    el["book-submit"].disabled = true;

    const payload = {
      name,
      email,
      phone: (f.get("phone") || "").trim(),
      where: (f.get("where") || "").trim(),
      message: (f.get("message") || "").trim(),
      date: pick.date,
      start: pick.slot,
      minutes: minutes(),
      pay: pick.pay,
      reference: reference(),
      estimate: KL.compute(state),
      summary: KL.summary(state),
      state,
    };

    postBooking(payload).then((res) => {
      if (res && res.refused) {
        el["form-note"].textContent = res.refused;
        el["form-note"].classList.add("is-bad");
        el["book-submit"].disabled = false;
        /* most likely the day went while this form was open, so go and
           find out what's actually free before they try again */
        if (res.status === 409) {
          pick.date = null;
          pick.slot = null;
          refreshAvailability().then(() => {
            renderCalendar();
            syncAll();
            el["form-note"].textContent = res.refused;
            el["form-note"].classList.add("is-bad");
          });
        }
        return;
      }
      if (res && res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      if (!res) mailFallback(payload);
      finish(payload, !!res);
    });
  });

  /* Ask the backend, if there is one.

     null            no backend, or it never answered — send the email instead
     {ok:true, …}    it took the booking
     {refused: msg}  it answered and said no (the day went, bad input) */
  function postBooking(payload) {
    if (window.location.protocol === "file:" || typeof fetch !== "function") {
      return Promise.resolve(null);
    }
    const ctrl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 8000) : null;

    return fetch("api/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl ? ctrl.signal : undefined,
    })
      .then((r) =>
        r.json().catch(() => null).then((data) => {
          /* not deployed, or deployed but unconfigured: pretend there's
             no backend at all and let the email flow handle it */
          if (r.status === 404 || r.status === 501) return null;
          if (r.ok && data && data.ok) return data;
          if (data && data.error) return { refused: data.error, status: r.status };
          return null;
        })
      )
      .catch(() => null)
      .then((r) => {
        if (timer) clearTimeout(timer);
        return r;
      });
  }

  function mailFallback(p) {
    const calc = p.estimate;
    const body = [
      "Hi Kiana,",
      "",
      "I'd like to book:",
      "",
      "Session:   " + calc.session.name,
      "Date:      " + S.longDate(p.date),
      "Time:      " + S.clockLabel(p.start) + " – " + S.clockLabel(p.start + p.minutes),
      "Length:    " + KL.hoursLabel(state.halfHours, true),
      "Where:     " + (p.where || "up to you"),
      "",
      "On the slip: " + p.summary,
      "Estimate:  " + KL.money(calc.total),
      "Deposit:   " + KL.moneyShort(calc.deposit) + " (" + payLabel() + ")",
      "Ref:       " + p.reference,
      "",
      p.message || "",
      "",
      p.name,
      p.email + (p.phone ? " · " + p.phone : ""),
      "",
    ].join("\n");

    const subject = "Booking: " + calc.session.name + " — " + S.shortDate(p.date) + ", " + S.clockLabel(p.start);
    window.location.href =
      "mailto:" + P.email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }

  function payLabel() {
    const m = PAY.find((x) => x.id === pick.pay);
    return m ? m.name : "";
  }

  function finish(p, viaApi) {
    sent = true;
    const calc = p.estimate;

    document.querySelectorAll(".est-block").forEach((b) => (b.hidden = true));
    el["book-bar"].hidden = true;

    el["done-when"].textContent = S.longDate(p.date) + " · " + S.clockLabel(p.start);
    el["done-copy"].textContent = viaApi
      ? "That's pencilled in. The day is held for you until she confirms, usually within a day."
      : "Your email app should have opened with everything filled in. Send it and she'll " +
        "confirm within a day. If nothing opened, email " + P.email + " and quote " + p.reference + ".";

    el["pay-actions"].textContent = "";

    const card = stripeUrl(p.email);
    if (pick.pay === "card" && card) {
      el["pay-actions"].appendChild(payButton(card, "PAY " + KL.moneyShort(calc.deposit) + " BY CARD", true));
      el["pay-actions"].appendChild(payButton(venmoUrl(calc.deposit), "or use Venmo", false));
    } else if (pick.pay === "venmo") {
      el["pay-actions"].appendChild(
        payButton(venmoUrl(calc.deposit), "PAY " + KL.moneyShort(calc.deposit) + " ON VENMO", true)
      );
      if (card) el["pay-actions"].appendChild(payButton(card, "or pay by card", false));
    } else if (pick.pay === "card" && !card) {
      const note = document.createElement("p");
      note.className = "pay-pending";
      note.textContent =
        "She'll email a Stripe link for the " + KL.moneyShort(calc.deposit) +
        " deposit when she confirms. Nothing is owed until then.";
      el["pay-actions"].appendChild(note);
      el["pay-actions"].appendChild(payButton(venmoUrl(calc.deposit), "or send it on Venmo now", false));
    } else {
      const note = document.createElement("p");
      note.className = "pay-pending";
      note.textContent =
        "No rush on the " + KL.moneyShort(calc.deposit) + " deposit. She'll send payment details with her reply.";
      el["pay-actions"].appendChild(note);
    }

    el["done-fine"].textContent = "Ref " + p.reference + " · estimate " + KL.money(calc.total);
    el.done.hidden = false;

    /* the page just got a lot shorter — let it settle before scrolling,
       or the smooth scroll aims at a position that no longer exists */
    requestAnimationFrame(() => {
      if (typeof ScrollTrigger !== "undefined") ScrollTrigger.refresh();
      requestAnimationFrame(() => scrollTo(el.done));
    });

    if (!KL.reduced && typeof gsap !== "undefined") {
      gsap.from(el.done.children, {
        autoAlpha: 0,
        y: 18,
        duration: 0.6,
        stagger: 0.07,
        ease: "power3.out",
      });
    }
  }

  function payButton(href, text, primary) {
    const a = document.createElement("a");
    a.className = primary ? "pay-btn" : "pay-btn pay-btn--ghost";
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = text;
    a.setAttribute("data-cursor", "hi");
    return a;
  }

  /* ---------------- odds and ends ---------------- */

  function scrollTo(node) {
    if (!node) return;
    if (window.lenisInstance) window.lenisInstance.scrollTo(node, { offset: -90, duration: 1.1 });
    else node.scrollIntoView({ behavior: KL.reduced ? "auto" : "smooth", block: "start" });
  }

  /* ---------------- sync ---------------- */

  function syncAll() {
    const session = KL.byId(P.sessions, state.session);
    const minHalf = Math.round(session.minHours * 2);

    el["session-chips"].querySelectorAll("input").forEach((input) => {
      const on = input.value === state.session;
      input.checked = on;
      input.closest(".chip").classList.toggle("is-on", on);
    });

    state.halfHours = KL.clampHalfHours(state.session, state.halfHours);
    el.hours.min = minHalf;
    el.hours.max = MAX_HALF_HOURS;
    el.hours.value = state.halfHours;
    el.hours.style.setProperty(
      "--fill",
      ((state.halfHours - minHalf) / (MAX_HALF_HOURS - minHalf)) * 100 + "%"
    );
    el["hours-read"].textContent = KL.hoursLabel(state.halfHours);
    buildScale(minHalf, MAX_HALF_HOURS);
    el["session-note"].textContent =
      session.note ||
      (state.rolls + (state.rolls === 1 ? " roll" : " rolls") + " of " +
        KL.byId(P.stocks, state.stock).name + " on the slip. Change any of that on the pricing page.");

    renderSlots();

    const calc = KL.compute(state);
    KL.renderSlipBody(el["slip-body"], calc);
    KL.setTotal(el["slip-total"], calc.total);
    el["slip-deposit"].textContent = KL.moneyShort(calc.deposit);
    el["slip-no"].textContent = KL.slipNumber(state);
    el["pay-amount"].textContent = KL.moneyShort(calc.deposit);
    el["slip-status"].textContent =
      "Estimate " + KL.money(calc.total) + ", deposit " + KL.moneyShort(calc.deposit) + ".";
    KL.setTotal(el["book-bar-total"], calc.total);
    el["book-bar-when"].textContent = !pick.date
      ? "Pick a day"
      : pick.slot == null
        ? S.shortDate(pick.date) + " · pick a time"
        : S.shortDate(pick.date) + " · " + S.clockLabel(pick.slot);

    el["slip-when"].textContent = "";
    const when = [
      ["SESSION", session.name],
      ["DATE", pick.date ? S.longDate(pick.date) : "—"],
      ["TIME", pick.slot != null
        ? S.clockLabel(pick.slot) + " – " + S.clockLabel(pick.slot + minutes())
        : "—"],
    ];
    when.forEach(([k, v]) => {
      const row = document.createElement("p");
      row.className = "slip-when-row" + (v === "—" ? " is-empty" : "");
      const key = document.createElement("span");
      key.textContent = k;
      const val = document.createElement("span");
      val.textContent = v;
      row.append(key, val);
      el["slip-when"].appendChild(row);
    });

    const ready = !!pick.date && pick.slot != null;
    el["book-submit"].classList.toggle("is-idle", !ready);
    if (!sent && !el["form-note"].classList.contains("is-bad")) {
      el["form-note"].textContent = ready
        ? "She answers everything, usually the same day."
        : "Pick a day and a start time above before sending.";
    }

    el["pay-grid"].querySelectorAll("input").forEach((input) => {
      const on = input.value === pick.pay;
      input.checked = on;
      input.closest(".pay-card").classList.toggle("is-on", on);
    });

    KL.save(state);
  }

  /* ---------------- boot ---------------- */

  function boot() {
    viewMonth = firstOfMonth(S.firstOpenDay(minutes()));
    renderCalendar();
    syncAll();
  }

  boot();

  /* If a backend is answering, let it have the last word on what's
     free. Silence is fine; the file's schedule stands. */
  function refreshAvailability() {
    if (window.location.protocol === "file:" || typeof fetch !== "function") {
      return Promise.resolve(false);
    }
    return fetch("api/availability", { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((data) => (data ? S.merge(data) : false));
  }

  refreshAvailability().then((changed) => {
    if (!changed) return;
    revalidate();
    renderCalendar();
    syncAll();
  });
})();
