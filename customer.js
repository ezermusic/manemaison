/* Customer pages: product detail (gallery, reviews, related), wishlist, order and booking tracking. Loaded after app.js. */
const CUSTOMER_PAGES = {
  async product() {
    const id = +new URLSearchParams(location.search).get("id"),
      [P, R] = await Promise.all([db.get("products"), db.get("reviews")]),
      p = P.find((x) => x.id == id && x.active !== false),
      box = $("#pd");
    if (!p) {
      box.innerHTML = `<p>We couldn't find that product.</p><br><a class="btn" href="shop.html">Back to shop</a>`;
      return;
    }
    document.title = p.name + " — Mane Maison";
    const base = slug(p.name),
      files =
        p.imgs && p.imgs.length
          ? p.imgs
          : [p.img || base + ".jpg", base + "-2.jpg", base + "-3.jpg", base + "-4.jpg"],
      rv = R.filter((r) => r.pid == p.id && r.status == "approved"),
      avg = rv.length ? rv.reduce((a, r) => a + r.rating, 0) / rv.length : 0,
      w = wish.get().map(String).includes(String(p.id));
    box.innerHTML = `<div class="pdp"><div class="gal"><div class="art has main" style="--h:${(p.id * 47) % 360}">${esc(
      p.name
        .split(" ")
        .slice(0, 2)
        .map((x) => x[0])
        .join(""),
    )}<img id="gm" src="${esc(imgSrc(p.name, files[0]))}" alt="${esc(p.name)}" onerror="imgNext(this)"></div><div class="thumbs">${files.map((f) => `<button type="button" class="tb" data-f="${esc(f)}" aria-label="Show photo"><img src="${esc(imgSrc(p.name, f))}" alt="" loading="lazy" onerror="imgNext(this)"></button>`).join("")}</div></div>
    <div class="info"><p class="meta">${esc(p.cat)}</p><h1>${esc(p.name)}</h1><p class="stars">${rv.length ? stars(avg) + ` <small>${avg.toFixed(1)} · ${rv.length} review${rv.length > 1 ? "s" : ""}</small>` : "<small>No reviews yet</small>"}</p><p class="serif" style="font-size:2.2rem">${money(p.price)}</p><p>${esc(p.desc || "A quality product from the Mane Maison collection.")}</p><p><small>${p.stock < 1 ? "Currently sold out" : p.stock <= (p.threshold || 5) ? "Only " + p.stock + " left" : "In stock"}</small></p>
    <div class="buy"><label class="qty">Qty<input id="qty" type="number" min="1" max="${Math.max(1, p.stock)}" value="1"></label><button id="addp" ${p.stock < 1 ? "disabled" : ""}>Add to bag</button><button class="heart big${w ? " on" : ""}" data-wish="${p.id}" aria-label="Save to wishlist">${w ? "♥" : "♡"}</button></div>
    <p><a class="btn ghost" target="_blank" rel="noopener" href="https://wa.me/${CFG.WA}?text=${encodeURIComponent("Hello Mane Maison, I have a question about: " + p.name)}">Ask about this product</a></p></div></div>
    <section><h2>Reviews</h2><br><div id="rv">${rv.map((r) => `<div class="rev"><p class="stars">${stars(r.rating)}</p><p>${esc(r.text)}</p><small>${esc(r.name)} · ${r.date}</small></div>`).join("") || "<p>Be the first to review this product.</p>"}</div><br>
    <form id="rf" class="revform"><h3>Write a review</h3><div class="g2"><input name="name" placeholder="Your name" required><select name="rating" aria-label="Rating"><option value="5">★★★★★ Excellent</option><option value="4">★★★★ Good</option><option value="3">★★★ Okay</option><option value="2">★★ Poor</option><option value="1">★ Bad</option></select></div><textarea name="text" rows="3" placeholder="Share your experience" required></textarea><button>Submit review</button></form></section>
    <section><h2>You may also like</h2><br><div class="grid" id="rel"></div></section>`;
    $$(".tb", box).forEach(
      (b) =>
        (b.onclick = () => {
          $("#gm").src = imgSrc(p.name, b.dataset.f);
        }),
    );
    $("#addp").onclick = () => {
      const q = Math.max(1, Math.min(+$("#qty").value || 1, Math.max(1, p.stock))),
        c = cart.get(),
        i = c.find((x) => x.id == p.id);
      i ? (i.q += q) : c.push({ id: p.id, q });
      cart.set(c);
      toast(q + " added to your bag");
    };
    $("#rf").onsubmit = async (e) => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(e.target)),
        L = await db.get("reviews");
      L.push({
        id: Date.now(),
        pid: p.id,
        name: v.name.trim(),
        rating: +v.rating,
        text: v.text.trim(),
        date: day(0),
        status: "pending",
      });
      await db.put("reviews", L);
      await notify(
        "review",
        `New review for ${p.name} from ${v.name.trim()} (${v.rating}★)`,
        "admin-marketing.html",
      );
      e.target.reset();
      toast("Thank you! Your review will appear once approved.");
    };
    const act = P.filter((x) => x.id != p.id && x.active !== false),
      rel = [
        ...act.filter((x) => x.cat == p.cat),
        ...act.filter((x) => x.cat != p.cat),
      ].slice(0, 4);
    $("#rel").innerHTML = rel.map(card).join("");
  },
  async wishlist() {
    const P = (await db.get("products")).filter((p) => p.active !== false),
      draw = () => {
        const ids = wish.get(),
          L = ids.map((id) => P.find((p) => String(p.id) == String(id))).filter(Boolean);
        if (L.length != ids.length) wish.set(L.map((p) => pid(p.id)));
        $("#wl").innerHTML = L.length
          ? L.map(card).join("")
          : `<div class="empty"><p>Your wishlist is empty. Tap the heart on any product to save it here.</p><br><a class="btn" href="shop.html">Browse the shop</a></div>`;
        $("#wall").hidden = !L.length;
        wish.set(wish.get());
      };
    $("#wall").onclick = () => {
      const c = cart.get();
      wish.get().forEach((id) => {
        const p = P.find((x) => String(x.id) == String(id));
        if (p && p.stock > 0) {
          const i = c.find((x) => String(x.id) == String(p.id));
          i ? i.q++ : c.push({ id: pid(p.id), q: 1 });
        }
      });
      cart.set(c);
      toast("Wishlist items added to your bag");
    };
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-wish]")) setTimeout(draw, 0);
    });
    draw();
  },
  track() {
    const f = $("#tf"),
      out = $("#tr"),
      d9 = (s) =>
        String(s || "")
          .replace(/\D/g, "")
          .slice(-9),
      qs = new URLSearchParams(location.search);
    if (qs.get("ref")) f.elements.ref.value = qs.get("ref");
    const tl = (steps, cur, bad) =>
      `<ol class="tl">${steps.map((s, i) => `<li class="${bad ? "" : i <= cur ? "done" : ""}"><i></i><span>${s[0]}</span><small>${s[1] || ""}</small></li>`).join("")}</ol>`;
    f.onsubmit = async (e) => {
      e.preventDefault();
      const kind = f.elements.kind.value,
        ref = f.elements.ref.value.trim().toUpperCase(),
        ph = d9(f.elements.phone.value),
        L = await db.get(kind == "order" ? "orders" : "bookings"),
        r = L.find((x) => String(x.ref || "").toUpperCase() == ref && d9(x.phone) == ph);
      if (!r) {
        out.innerHTML = `<div class="sumbox"><p>We couldn't find that ${kind}. Check the number and the phone you used when ordering.</p></div>`;
        return;
      }
      if (kind == "order") {
        const st = r.status,
          hist = (s) => {
            const h = (r.history || []).find((x) => x.status == s);
            return h ? when(h.ts) : "";
          },
          P = await db.get("products"),
          items = (r.items || [])
            .map((i) => ({ p: P.find((p) => p.id == i.id), q: i.q }))
            .filter((x) => x.p);
        out.innerHTML = `<div class="sumbox"><h3>Order ${esc(r.ref)}</h3><p class="meta">Placed ${r.date} · ${esc(r.name)}</p>${
          st == "Cancelled"
            ? `<p><span class="st st-cancelled">Cancelled</span></p>`
            : tl(
                [
                  ["Order placed", hist("Pending") || r.date],
                  ["Packed", hist("Packed")],
                  ["Delivered", hist("Delivered")],
                ],
                ["Pending", "Packed", "Delivered"].indexOf(st),
              )
        }<div class="line"><span>Payment</span><b>${esc(r.pay ? r.pay.status : "Paid")}</b></div>${items.map((x) => `<div class="line"><span>${x.q} × ${esc(x.p.name)}</span><b>${money(x.p.price * x.q)}</b></div>`).join("")}<div class="line big"><span>Total</span><b>${money(r.total)}</b></div></div>`;
      } else {
        const st = r.status || "Pending",
          bad = ["Cancelled", "No-show"].includes(st),
          dep =
            r.deposit && r.deposit.required
              ? `<div class="line"><span>Deposit</span><b>${money(r.deposit.required)} · ${esc(r.deposit.status)}</b></div>`
              : "";
        out.innerHTML = `<div class="sumbox"><h3>Booking ${esc(r.ref)}</h3><p class="meta">${nice(r.date)} at ${r.time}${r.stylist ? " · " + esc(r.stylist) : ""}</p>${
          bad
            ? `<p><span class="st st-cancelled">${esc(st)}</span></p>`
            : tl(
                [
                  ["Request received", ""],
                  ["Confirmed", ""],
                  ["Completed", ""],
                ],
                ["Pending", "Confirmed", "Completed"].indexOf(st),
              )
        }<p>${esc(r.service)}</p>${dep}<div class="line big"><span>Total</span><b>${money(r.total || 0)}</b></div></div>`;
      }
    };
    if (qs.get("ref") && qs.get("phone")) {
      f.elements.phone.value = qs.get("phone");
      f.requestSubmit();
    }
  },
};
const when = (ts) =>
  new Date(ts).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
CUSTOMER_PAGES[document.body.dataset.page]?.();
