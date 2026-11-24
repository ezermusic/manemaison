/* Management: bookings (calendar, stylists, deposits, reminders), studio settings, and marketing (discount codes, gift cards, reviews).
   Loaded after admin-tools.js and before admin.js. */
const DEP_STATUS = [
  "Not required",
  "Awaiting confirmation",
  "Paid online",
  "Paid by gift card",
  "Paid at studio",
  "Refunded",
];
const fillMsg = (t, b) =>
  t.replace(/\{(\w+)\}/g, (_, k) => {
    const v = {
      name: b.name,
      date: nice(b.date),
      time: b.time,
      stylist: b.stylist || "our team",
      services: b.services
        ? Object.values(b.services)
            .flat()
            .map((x) => x.name)
            .join(", ")
        : b.service,
      ref: b.ref || "",
    }[k];
    return v == null ? "" : v;
  });
/* Sends a reminder/confirmation. Without a server it opens WhatsApp to the client; with CFG.API your server sends SMS/WhatsApp (POST /messages). */
function sendClient(b, kind, S) {
  const text = fillMsg(S.msgs[kind], b);
  if (CFG.API) {
    fetch(CFG.API + "/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "sms", to: b.phone, text, bookingId: b.id, kind }),
    });
    return true;
  }
  const w = window.open(
    "https://wa.me/" + waPhone(b.phone) + "?text=" + encodeURIComponent(text),
    "_blank",
  );
  if (!w) toast("Allow pop-ups to open WhatsApp");
  return !!w;
}

/* ---------- Bookings ---------- */
TOOL_VIEWS.bookings = async (me, m) => {
  let B = await db.get("bookings");
  const S = studioCfg(await getSettings()),
    sty = S.stylists,
    first = sty[0].id;
  let view = "Upcoming",
    q = "",
    sf = "All",
    cd = day(0);
  const stOf = (b) => b.status || "Pending",
    sid = (b) => String(b.stylistId || first),
    sname = (b) => b.stylist || (sty.find((x) => String(x.id) == sid(b)) || sty[0]).name,
    end = (b) => fmtMin(toMin(b.time) + (b.mins || S.slot)),
    live = (b) => !["Cancelled", "No-show"].includes(stOf(b));
  m.innerHTML = `<div class="chips" id="bc"></div><div class="tool"><input id="q" placeholder="Search client, phone, number or service"><select id="sf" aria-label="Stylist"></select><button id="add">+ New booking</button><button class="ghost" id="rem">Reminders</button></div><p class="meta" id="sum"></p><div id="body"></div>`;
  const save = () => db.put("bookings", B);
  const due = () =>
    B.filter(
      (b) =>
        b.date == shiftDay(day(0), 1) && live(b) && stOf(b) != "Completed" && !b.reminded,
    ).length;
  const changeStatus = async (b, s) => {
    if (s == "Confirmed" && stOf(b) != "Confirmed" && S.confirmPrompt && b.phone) {
      sendClient(b, "confirm", S);
      b.confirmSent = new Date().toISOString();
    }
    b.status = s;
    await save();
    draw();
    toast("Status updated");
  };
  const list = () => {
    const inView = (b) =>
      view == "All" ||
      (view == "Today" && b.date == day(0)) ||
      (view == "Upcoming" && b.date >= day(0)) ||
      (view == "Past" && b.date < day(0));
    const L = B.filter(
      (b) =>
        inView(b) &&
        (sf == "All" || sid(b) == sf) &&
        (b.name + " " + (b.phone || "") + " " + (b.ref || "") + " " + b.service)
          .toLowerCase()
          .includes(q.toLowerCase()),
    ).sort(
      (a, b) =>
        (view == "Past" ? -1 : 1) * (a.date + a.time).localeCompare(b.date + b.time),
    );
    $("#sum").textContent =
      `${L.length} bookings · ${money(L.filter(live).reduce((a, b) => a + (b.total || 0), 0))} expected value`;
    $("#body").innerHTML =
      `<div class="tbl"><table id="tb"><tr><th>No.<th>When<th>Client<th>Stylist<th>Services<th>Total<th>Deposit<th>Status<th></tr>` +
      (L.map(
        (b) =>
          `<tr><td>${esc(b.ref || "—")}<td>${b.date}<br><small>${b.time}–${end(b)}</small><td>${esc(b.name)}<br><small>${esc(b.phone || "")}</small><td>${esc(sname(b))}<td class="clip" title="${esc(b.service)}">${esc(b.service)}<td>${b.total == null ? "—" : money(b.total)}<td>${b.deposit && b.deposit.required ? pill(b.deposit.status) + "<br><small>" + money(b.deposit.required) + "</small>" : "—"}<td><select data-st="${b.id}" aria-label="Booking status">${opts(BOOK_STATUS, stOf(b))}</select><td><button class="ghost" data-e="${b.id}">Edit</button> <button class="ghost dng" data-d="${b.id}">Delete</button></tr>`,
      ).join("") || `<tr><td colspan="9">No bookings match.</tr>`) +
      `</table></div>`;
  };
  const cal = () => {
    const date = cd,
      closed =
        S.closedDays.includes(new Date(date + "T12:00").getDay()) ||
        S.closedDates.includes(date),
      dayB = B.filter((b) => b.date == date && stOf(b) != "Cancelled"),
      cols = sty.filter(
        (x) => x.active !== false || dayB.some((b) => sid(b) == String(x.id)),
      ),
      n = Math.max(0, Math.floor((toMin(S.close) - toMin(S.open)) / S.slot)),
      skip = {};
    let h = `<div class="tool"><button class="ghost" id="cp">←</button><input type="date" id="cdt" value="${date}"><button class="ghost" id="cn">→</button></div>${closed ? `<p class="meta">The studio is closed on this day.</p>` : ""}<div class="tbl"><table class="calt"><tr><th>Time${cols.map((x) => `<th>${esc(x.name)}`).join("")}</tr>`;
    for (let r = 0; r < n; r++) {
      const t = toMin(S.open) + r * S.slot;
      h +=
        `<tr><th>${fmtMin(t)}` +
        cols
          .map((x) => {
            if (skip[x.id] > 0) {
              skip[x.id]--;
              return "";
            }
            const b = dayB.find(
              (y) =>
                sid(y) == String(x.id) &&
                toMin(y.time) >= t &&
                toMin(y.time) < t + S.slot,
            );
            if (b) {
              const span = Math.max(1, Math.ceil((b.mins || S.slot) / S.slot));
              skip[x.id] = span - 1;
              return `<td rowspan="${span}" class="bk bk-${slug(stOf(b))}" data-e="${b.id}"><b>${esc(b.name)}</b><br><small>${b.time}–${end(b)} · ${esc(b.service)}</small></td>`;
            }
            return `<td class="free" data-new="${x.id}|${fmtMin(t)}"></td>`;
          })
          .join("") +
        `</tr>`;
    }
    $("#body").innerHTML =
      h +
      `</table></div><p class="meta">Click a booking to edit it, or an empty slot to add one.</p>`;
    $("#sum").textContent = `${dayB.length} bookings on ${nice(date)}`;
    $("#cdt").onchange = (e) => {
      cd = e.target.value || cd;
      draw();
    };
    $("#cp").onclick = () => {
      cd = shiftDay(cd, -1);
      draw();
    };
    $("#cn").onclick = () => {
      cd = shiftDay(cd, 1);
      draw();
    };
  };
  const draw = () => {
    $("#bc").innerHTML = ["Upcoming", "Today", "Past", "All", "Calendar"]
      .map((s) => `<button data-c="${s}" class="${s == view ? "on" : ""}">${s}</button>`)
      .join("");
    $("#sf").innerHTML =
      `<option value="All">All stylists</option>` +
      sty
        .map(
          (x) =>
            `<option value="${x.id}"${String(x.id) == sf ? " selected" : ""}>${esc(x.name)}</option>`,
        )
        .join("");
    $("#rem").textContent = "Reminders" + (due() ? ` (${due()})` : "");
    view == "Calendar" ? cal() : list();
  };
  const edit = (b, pre) => {
    pre = pre || {};
    const r = b || {
        date: pre.date || day(0),
        time: pre.time || S.open,
        mins: S.slot,
        stylistId: pre.stylistId || first,
        name: "",
        phone: "",
        email: "",
        service: "",
        total: 0,
        status: "Pending",
        note: "",
        deposit: { required: 0, status: "Not required" },
      },
      dep = r.deposit || { required: 0, status: "Not required" },
      wa = `https://wa.me/${waPhone(r.phone)}`,
      d = modal(
        `<form id="bfm"><h2>${b ? "Booking " + esc(b.ref || "") : "New booking"}</h2>` +
          `<div class="g3"><label>Date<input type="date" name="date" required value="${r.date}"></label><label>Time<input type="time" name="time" required value="${r.time}"></label><label>Duration (min)<input type="number" name="mins" min="5" step="5" required value="${r.mins || S.slot}"></label></div>` +
          `<div class="g2"><label>Stylist<select name="sid">${sty.map((x) => `<option value="${x.id}"${String(x.id) == String(r.stylistId || first) ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label><label>Status<select name="status">${opts(BOOK_STATUS, stOf(r))}</select></label></div>` +
          `<div class="g2"><label>Client<input name="name" required value="${esc(r.name)}"></label><label>Phone<input name="phone" type="tel" required value="${esc(r.phone || "")}"></label></div>` +
          `<label>Services<textarea name="service" rows="3" required>${esc(r.service || "")}</textarea></label>` +
          `<div class="g3"><label>Total (GH₵)<input name="total" type="number" min="0" step="0.01" value="${r.total == null ? 0 : r.total}"></label><label>Deposit (GH₵)<input name="dreq" type="number" min="0" step="0.01" value="${dep.required || 0}"></label><label>Deposit status<select name="dst">${opts(DEP_STATUS, dep.status)}</select></label></div>` +
          `<label>Internal note<textarea name="note" rows="2">${esc(r.note || "")}</textarea></label>` +
          `<div class="mbtn">${b ? `<a class="btn ghost" href="${wa}" target="_blank" rel="noopener">WhatsApp</a><button type="button" class="ghost" id="bc1">Send confirmation</button><button type="button" class="ghost" id="br1">Send reminder</button><button type="button" class="ghost" id="rcp">Receipt</button>` : ""}<button type="button" class="ghost" data-close>Cancel</button><button>Save</button></div></form>`,
      );
    if (b) {
      $("#bc1", d).onclick = async () => {
        sendClient(b, "confirm", S);
        b.confirmSent = new Date().toISOString();
        await save();
      };
      $("#br1", d).onclick = async () => {
        sendClient(b, "reminder", S);
        b.reminded = new Date().toISOString();
        await save();
        draw();
      };
      $("#rcp", d).onclick = () => printDoc("Receipt " + b.name, receiptHTML(b));
    }
    $("#bfm", d).onsubmit = async (e) => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(e.target)),
        st = sty.find((x) => String(x.id) == v.sid) || sty[0],
        s0 = toMin(v.time),
        e0 = s0 + +v.mins,
        clash = B.find(
          (x) =>
            x !== b &&
            x.date == v.date &&
            sid(x) == String(st.id) &&
            live(x) &&
            v.status != "Cancelled" &&
            s0 < toMin(x.time) + (x.mins || S.slot) &&
            toMin(x.time) < e0,
        );
      if (
        clash &&
        !confirm(
          `${st.name} already has a booking (${clash.time}–${end(clash)}) that overlaps. Save anyway?`,
        )
      )
        return;
      if (
        v.status == "Confirmed" &&
        b &&
        stOf(b) != "Confirmed" &&
        S.confirmPrompt &&
        v.phone
      ) {
        sendClient({ ...b, ...v, stylist: st.name }, "confirm", S);
        if (b) b.confirmSent = new Date().toISOString();
      }
      const rec = {
        date: v.date,
        time: v.time,
        mins: +v.mins,
        stylistId: st.id,
        stylist: st.name,
        name: v.name.trim(),
        phone: v.phone.trim(),
        service: v.service.trim(),
        total: +v.total,
        status: v.status,
        note: v.note.trim(),
        deposit: { ...dep, required: +v.dreq, status: +v.dreq ? v.dst : "Not required" },
      };
      if (b) {
        if (b.service != rec.service) delete b.services;
        Object.assign(b, rec);
      } else B.push({ id: Date.now(), ref: nextRef(B, "BK-"), ...rec });
      await save();
      d.close();
      draw();
      toast(b ? "Booking updated" : "Booking added");
    };
  };
  const reminders = () => {
    let rd = shiftDay(day(0), 1);
    const d = modal(
        `<h2>Booking reminders</h2><p class="meta">Send each client a reminder the day before. ${CFG.API ? "Messages are sent by your server." : "Each button opens WhatsApp with the message ready to send."}</p><label>Bookings on<input type="date" id="rd" value="${rd}"></label><div id="rl"></div><div class="mbtn"><button type="button" class="ghost" data-close>Close</button></div>`,
      ),
      paint = () => {
        const L = B.filter((b) => b.date == rd && live(b) && stOf(b) != "Completed").sort(
          (a, b) => a.time.localeCompare(b.time),
        );
        $("#rl", d).innerHTML =
          L.map(
            (b) =>
              `<div class="line"><span><b>${esc(b.name)}</b> · ${b.time} · ${esc(sname(b))}<br><small>${b.reminded ? "Reminder sent " + when(b.reminded) : "Not reminded yet"}</small></span><div><button data-r="${b.id}">${b.reminded ? "Resend" : "Send reminder"}</button></div></div>`,
          ).join("") || "<p>No bookings on this day.</p>";
      };
    $("#rd", d).onchange = (e) => {
      rd = e.target.value || rd;
      paint();
    };
    d.addEventListener("click", async (e) => {
      const x = e.target.closest("[data-r]");
      if (!x) return;
      const b = B.find((y) => y.id == x.dataset.r);
      sendClient(b, "reminder", S);
      b.reminded = new Date().toISOString();
      await save();
      paint();
      draw();
    });
    paint();
  };
  $("#bc").onclick = (e) => {
    const b = e.target.closest("[data-c]");
    if (b) {
      view = b.dataset.c;
      draw();
    }
  };
  $("#q").oninput = (e) => {
    q = e.target.value;
    draw();
  };
  $("#sf").onchange = (e) => {
    sf = e.target.value;
    draw();
  };
  $("#add").onclick = () => edit();
  $("#rem").onclick = reminders;
  $("#body").onclick = async (e) => {
    const nw = e.target.closest("[data-new]");
    if (nw) {
      const [s, t] = nw.dataset.new.split("|");
      return edit(null, { stylistId: s, time: t, date: cd });
    }
    const ed = e.target.closest("[data-e]");
    if (ed) return edit(B.find((x) => x.id == ed.dataset.e));
    const del = e.target.closest("[data-d]");
    if (del) {
      const x = B.find((y) => y.id == del.dataset.d);
      if (
        !confirm(`Delete the booking for ${x.name} on ${x.date}? This cannot be undone.`)
      )
        return;
      B = B.filter((y) => y !== x);
      await save();
      draw();
      toast("Booking deleted");
    }
  };
  $("#body").onchange = (e) => {
    const s = e.target.closest("[data-st]");
    if (s)
      changeStatus(
        B.find((x) => x.id == s.dataset.st),
        s.value,
      );
  };
  draw();
};

/* ---------- Studio settings (hours, days off, stylists, deposits, messages) ---------- */
async function studioPanel(el) {
  let S = studioCfg(await getSettings());
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let cds = [...S.closedDates].sort();
  const persist = async (patch) => {
    const X = await getSettings();
    Object.assign(X, patch);
    await db.put("settings", X);
    S = studioCfg(X);
  };
  el.innerHTML = `<h3>Studio hours, days off and deposits</h3><form id="sf" class="studio">
    <div class="g3"><label>Opens<input type="time" name="open" value="${S.open}"></label><label>Closes<input type="time" name="close" value="${S.close}"></label><label>Slot length<select name="slot">${opts(
      ["15", "30", "45", "60", "90"].map((x) => x + " min"),
      S.slot + " min",
    )}</select></label></div>
    <fieldset class="perm"><legend>Closed every</legend><div class="wk">${days.map((d, i) => `<label class="sw"><input type="checkbox" name="cd" value="${i}" ${S.closedDays.includes(i) ? "checked" : ""}> ${d}</label>`).join("")}</div></fieldset>
    <div class="tool"><label class="fl">Closed on a date (holiday)<input type="date" id="xd"></label><button type="button" class="ghost" id="xa">Add date</button></div><div class="dchips" id="xl"></div>
    <label class="sw"><input type="checkbox" name="don" ${S.deposit.on ? "checked" : ""}> Ask for a deposit to hold a booking</label>
    <div class="g2"><label>Deposit type<select name="dtype">${opts(["percent", "fixed"], S.deposit.type)}</select></label><label>Deposit value (% or GH₵)<input name="dval" type="number" min="0" step="0.01" value="${S.deposit.value}"></label></div>
    <label>Deposit instructions shown to clients<textarea name="dnote" rows="2" placeholder="e.g. Send to MoMo 0537751108 (Mane Maison) and enter the transaction ID.">${esc(S.deposit.note || "")}</textarea></label>
    <label>Reminder message (sent the day before)<textarea name="mrem" rows="3">${esc(S.msgs.reminder)}</textarea></label>
    <label>Confirmation message (sent when a booking is confirmed)<textarea name="mcon" rows="3">${esc(S.msgs.confirm)}</textarea></label>
    <p class="meta">You can use {name}, {date}, {time}, {stylist}, {services} and {ref}.</p>
    <label class="sw"><input type="checkbox" name="cp" ${S.confirmPrompt ? "checked" : ""}> Open the confirmation message when I mark a booking Confirmed</label>
    <div class="mbtn" style="justify-content:flex-start"><button>Save studio settings</button></div></form>
    <h3 style="margin-top:22px">Stylists</h3><p class="meta">Each stylist has their own calendar, and clients can choose one when booking.</p><div class="tool"><input id="sn" placeholder="Stylist name"><button id="sa">+ Add stylist</button></div><div class="tbl"><table id="stt"></table></div>`;
  const chips = () => {
    $("#xl").innerHTML =
      cds
        .map(
          (d) =>
            `<span class="dchip">${nice(d)} <button type="button" data-x="${d}" aria-label="Remove">×</button></span>`,
        )
        .join("") || `<small>No special closed dates.</small>`;
  };
  chips();
  $("#xa").onclick = () => {
    const v = $("#xd").value;
    if (v && !cds.includes(v)) cds = [...cds, v].sort();
    chips();
  };
  $("#xl").onclick = (e) => {
    const b = e.target.closest("[data-x]");
    if (b) {
      cds = cds.filter((x) => x != b.dataset.x);
      chips();
    }
  };
  $("#sf").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target),
      v = Object.fromEntries(f);
    if (toMin(v.close) <= toMin(v.open))
      return toast("Closing time must be after opening time");
    await persist({
      open: v.open,
      close: v.close,
      slot: parseInt(v.slot),
      closedDays: f.getAll("cd").map(Number),
      closedDates: cds,
      deposit: { on: !!v.don, type: v.dtype, value: +v.dval, note: v.dnote.trim() },
      msgs: { reminder: v.mrem.trim(), confirm: v.mcon.trim() },
      confirmPrompt: !!v.cp,
    });
    toast("Studio settings saved");
  };
  const stylists = async (fn) => {
    const L = S.stylists.map((x) => ({ ...x }));
    const r = fn(L);
    if (r) return toast(r);
    await persist({ stylists: L });
    draw();
  };
  const draw = () => {
    $("#stt").innerHTML =
      `<tr><th>Name<th>Status<th></tr>` +
      S.stylists
        .map(
          (x) =>
            `<tr><td><b>${esc(x.name)}</b><td>${pill(x.active === false ? "Disabled" : "Active")}<td><button class="ghost" data-n="${x.id}">Rename</button> <button class="ghost" data-t="${x.id}">${x.active === false ? "Enable" : "Disable"}</button> <button class="ghost dng" data-r="${x.id}">Delete</button></tr>`,
        )
        .join("");
  };
  $("#sa").onclick = () => {
    const n = $("#sn").value.trim();
    if (!n) return toast("Enter a name");
    stylists(
      (L) =>
        L.push({ id: Math.max(0, ...L.map((x) => x.id)) + 1, name: n, active: true }) &&
        0,
    );
    $("#sn").value = "";
  };
  $("#stt").onclick = async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.n) {
      const x = S.stylists.find((y) => y.id == b.dataset.n),
        n = prompt("Stylist name", x.name);
      if (n && n.trim())
        stylists((L) => void (L.find((y) => y.id == x.id).name = n.trim()));
    }
    if (b.dataset.t)
      stylists((L) => {
        const x = L.find((y) => y.id == b.dataset.t);
        if (x.active !== false && L.filter((y) => y.active !== false).length < 2)
          return "Keep at least one active stylist";
        x.active = x.active === false;
      });
    if (b.dataset.r) {
      const x = S.stylists.find((y) => y.id == b.dataset.r),
        used = (await db.get("bookings")).some(
          (k) => String(k.stylistId) == String(x.id),
        );
      if (
        !confirm(
          `Delete ${x.name}?${used ? " Existing bookings keep their stylist name." : ""}`,
        )
      )
        return;
      stylists((L) => {
        if (L.length < 2) return "Keep at least one stylist";
        L.splice(
          L.findIndex((y) => y.id == x.id),
          1,
        );
      });
    }
  };
  draw();
}

/* ---------- Marketing: discount codes, gift cards, reviews ---------- */
TOOL_VIEWS.marketing = async (me, m) => {
  let [PR, GC, RV, P] = await Promise.all(
    ["promos", "giftcards", "reviews", "products"].map((c) => db.get(c)),
  );
  m.innerHTML = `<h3>Discount codes</h3><div class="tool"><button id="pa">+ New code</button></div><div class="tbl"><table id="pt"></table></div><br><h3>Gift cards</h3><div class="tool"><button id="ga">+ Issue gift card</button></div><div class="tbl"><table id="gt"></table></div><br><h3>Reviews</h3><div class="tbl"><table id="rt"></table></div>`;
  const gen = () => {
    const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
      r = crypto.getRandomValues(new Uint8Array(8));
    return (
      "GC-" +
      [...r]
        .map((x) => a[x % 32])
        .join("")
        .replace(/(.{4})(.{4})/, "$1-$2")
    );
  };
  const ok = (e) => !e || e >= day(0);
  const drawP = () => {
    $("#pt").innerHTML =
      `<tr><th>Code<th>Discount<th>Applies to<th>Used<th>Expires<th>Status<th></tr>` +
      (PR.map(
        (p) =>
          `<tr><td><b>${esc(p.code)}</b><td>${p.type == "percent" ? p.value + "%" : money(p.value)}${p.minSpend ? `<br><small>min ${money(p.minSpend)}</small>` : ""}<td>${esc(p.scope || "all")}<td>${p.used || 0}${p.maxUses ? " / " + p.maxUses : ""}<td>${p.expires || "—"}<td>${pill(p.active === false ? "Disabled" : ok(p.expires) ? "Active" : "Expired")}<td><button class="ghost" data-e="${p.id}">Edit</button> <button class="ghost dng" data-d="${p.id}">Delete</button></tr>`,
      ).join("") || `<tr><td colspan="7">No discount codes yet.</tr>`);
  };
  const drawG = () => {
    $("#gt").innerHTML =
      `<tr><th>Code<th>Balance<th>For<th>Issued<th>Expires<th>Status<th></tr>` +
      (GC.map(
        (g) =>
          `<tr><td><b>${esc(g.code)}</b><td>${money(g.balance)} <small>of ${money(g.initial)}</small><td>${esc(g.to || "—")}<td>${g.issued || "—"}<td>${g.expires || "—"}<td>${pill(g.active === false ? "Disabled" : !ok(g.expires) ? "Expired" : g.balance > 0 ? "Active" : "Used up")}<td><button class="ghost" data-e="${g.id}">Edit</button> <button class="ghost" data-h="${g.id}">History</button> <button class="ghost dng" data-d="${g.id}">Delete</button></tr>`,
      ).join("") || `<tr><td colspan="7">No gift cards issued yet.</tr>`);
  };
  const drawR = () => {
    $("#rt").innerHTML =
      `<tr><th>Product<th>Rating<th>Review<th>Date<th>Status<th></tr>` +
      (RV.slice()
        .reverse()
        .map(
          (r) =>
            `<tr><td>${esc((P.find((p) => p.id == r.pid) || { name: "Product " + r.pid }).name)}<td>${stars(r.rating)}<td class="clip" style="max-width:300px;white-space:normal"><b>${esc(r.name)}</b><br>${esc(r.text)}<td>${r.date}<td><select data-rs="${r.id}" aria-label="Review status">${opts(["pending", "approved", "hidden"], r.status)}</select><td><button class="ghost dng" data-d="${r.id}">Delete</button></tr>`,
        )
        .join("") || `<tr><td colspan="6">No reviews yet.</tr>`);
  };
  const promo = (p) => {
    const r = p || {
        code: "",
        type: "percent",
        value: 10,
        scope: "all",
        minSpend: "",
        expires: "",
        maxUses: "",
        active: true,
      },
      d = modal(
        `<form id="pf3"><h2>${p ? "Edit" : "New"} discount code</h2><div class="g2"><label>Code<input name="code" required value="${esc(r.code)}" style="text-transform:uppercase"></label><label>Applies to<select name="scope">${opts(["all", "shop", "studio"], r.scope || "all")}</select></label></div><div class="g2"><label>Type<select name="type">${opts(["percent", "fixed"], r.type)}</select></label><label>Value (% or GH₵)<input name="value" type="number" min="0" step="0.01" required value="${r.value}"></label></div><div class="g3"><label>Minimum spend<input name="min" type="number" min="0" value="${r.minSpend || ""}"></label><label>Expires<input name="exp" type="date" value="${r.expires || ""}"></label><label>Max uses<input name="max" type="number" min="0" value="${r.maxUses || ""}"></label></div><label class="sw"><input type="checkbox" name="active" ${r.active === false ? "" : "checked"}> Active</label><div class="mbtn"><button type="button" class="ghost" data-close>Cancel</button><button>Save</button></div></form>`,
      );
    $("#pf3", d).onsubmit = async (e) => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(e.target)),
        code = v.code.trim().toUpperCase();
      if (PR.find((x) => x !== p && x.code == code))
        return toast("That code already exists");
      const rec = {
        code,
        type: v.type,
        value: +v.value,
        scope: v.scope,
        minSpend: +v.min || 0,
        expires: v.exp,
        maxUses: +v.max || 0,
        active: !!v.active,
      };
      if (p) Object.assign(p, rec);
      else PR.push({ id: Math.max(0, ...PR.map((x) => x.id)) + 1, used: 0, ...rec });
      await db.put("promos", PR);
      d.close();
      drawP();
      toast("Discount code saved");
    };
  };
  const gift = (g) => {
    const r = g || {
        code: gen(),
        initial: "",
        balance: "",
        to: "",
        expires: "",
        active: true,
      },
      d = modal(
        `<form id="gf"><h2>${g ? "Edit" : "Issue"} gift card</h2><div class="g2"><label>Code<input name="code" required value="${esc(r.code)}" style="text-transform:uppercase"></label><label>Recipient<input name="to" value="${esc(r.to || "")}"></label></div><div class="g3"><label>${g ? "Original value" : "Value (GH₵)"}<input name="initial" type="number" min="1" step="0.01" required value="${r.initial}"></label><label>Balance<input name="balance" type="number" min="0" step="0.01" placeholder="same as value" value="${r.balance}"></label><label>Expires<input name="exp" type="date" value="${r.expires || ""}"></label></div><label class="sw"><input type="checkbox" name="active" ${r.active === false ? "" : "checked"}> Active</label><div class="mbtn"><button type="button" class="ghost" data-close>Cancel</button><button>Save</button></div></form>`,
      );
    $("#gf", d).onsubmit = async (e) => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(e.target)),
        code = v.code.trim().toUpperCase();
      if (GC.find((x) => x !== g && x.code == code))
        return toast("That code already exists");
      const rec = {
        code,
        to: v.to.trim(),
        initial: +v.initial,
        balance: v.balance === "" ? +v.initial : +v.balance,
        expires: v.exp,
        active: !!v.active,
      };
      if (g) Object.assign(g, rec);
      else
        GC.push({
          id: Math.max(0, ...GC.map((x) => x.id)) + 1,
          issued: day(0),
          history: [{ date: day(0), amount: rec.initial, ref: "Issued" }],
          ...rec,
        });
      await db.put("giftcards", GC);
      d.close();
      drawG();
      toast("Gift card saved");
    };
  };
  $("#pa").onclick = () => promo();
  $("#ga").onclick = () => gift();
  $("#pt").onclick = async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.e) promo(PR.find((x) => x.id == b.dataset.e));
    if (b.dataset.d) {
      const p = PR.find((x) => x.id == b.dataset.d);
      if (!confirm(`Delete code ${p.code}?`)) return;
      PR = PR.filter((x) => x !== p);
      await db.put("promos", PR);
      drawP();
    }
  };
  $("#gt").onclick = async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.e) gift(GC.find((x) => x.id == b.dataset.e));
    if (b.dataset.h) {
      const g = GC.find((x) => x.id == b.dataset.h);
      modal(
        `<h2>${esc(g.code)}</h2><p class="meta">Balance ${money(g.balance)} of ${money(g.initial)}</p>${(g.history || []).map((h) => `<div class="line"><span>${h.date} · ${esc(h.ref || "")}</span><b>${h.amount < 0 ? "−" : "+"}${money(Math.abs(h.amount))}</b></div>`).join("") || "<p>No activity yet.</p>"}<div class="mbtn"><button type="button" class="ghost" data-close>Close</button></div>`,
      );
    }
    if (b.dataset.d) {
      const g = GC.find((x) => x.id == b.dataset.d);
      if (
        !confirm(
          `Delete gift card ${g.code}? Its remaining balance (${money(g.balance)}) will be lost.`,
        )
      )
        return;
      GC = GC.filter((x) => x !== g);
      await db.put("giftcards", GC);
      drawG();
    }
  };
  $("#rt").onchange = async (e) => {
    const s = e.target.closest("[data-rs]");
    if (s) {
      RV.find((x) => x.id == s.dataset.rs).status = s.value;
      await db.put("reviews", RV);
      drawR();
      toast("Review updated");
    }
  };
  $("#rt").onclick = async (e) => {
    const b = e.target.closest("[data-d]");
    if (!b) return;
    if (!confirm("Delete this review?")) return;
    RV = RV.filter((x) => x.id != b.dataset.d);
    await db.put("reviews", RV);
    drawR();
  };
  drawP();
  drawG();
  drawR();
};
