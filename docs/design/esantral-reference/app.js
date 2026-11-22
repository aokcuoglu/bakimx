// BakımX: telefon ekranının ölçeklenmesi ve görünürken belirme.
(function () {
  // Ekran arayüzü 350px genişlikte tasarlandı; elde telefon görselindeki ekran deliğine ölçeklenir
  var hand = document.querySelector(".hand");
  if (hand) {
    var hero = document.querySelector(".d-hero"), text = document.querySelector(".d-in");
    var fit = function () {
      // Telefon ekranının üstü düğmelerin altında, arada boşlukla başlasın (CSS'teki --text tahmini yerine ölçülen yükseklik)
      if (hero && text) hero.style.setProperty("--text", (text.offsetHeight + Math.max(44, Math.min(72, window.innerHeight * .06))) + "px");
      hand.style.setProperty("--s", (hand.querySelector(".hand-screen").clientWidth / 350).toFixed(4));
    };
    fit(); window.addEventListener("resize", fit);
  }
  var items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) { items.forEach(function (el) { el.classList.add("in"); }); return; }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.1 });
  items.forEach(function (el) { io.observe(el); });
})();

// Pencereler: "Ücretsiz deneyin" kayıt formunu, "Sizi arayalım" arama kaydı formunu açar.
// Tanıtım sayfası: form veri göndermez; doğrulama sonrası onay ekranı gösterilir.
(function () {
  var opener = null;
  document.querySelectorAll("[data-open]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      var dlg = document.getElementById(a.getAttribute("data-open"));
      if (!dlg || !dlg.showModal) return;
      e.preventDefault();
      opener = a;
      var form = dlg.querySelector("form");
      form.reset();
      form.querySelector(".m-form").hidden = false;
      form.querySelector(".m-done").hidden = true;
      form.querySelector("[data-err]").hidden = true;
      form.querySelectorAll(".bad").forEach(function (i) { i.classList.remove("bad"); });
      dlg.showModal();
      var first = form.querySelector("input");
      if (first) setTimeout(function () { first.focus(); }, 60);
    });
  });
  document.querySelectorAll(".modal").forEach(function (dlg) {
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
    dlg.querySelectorAll("[data-close]").forEach(function (b) { b.addEventListener("click", function () { dlg.close(); }); });
    dlg.addEventListener("close", function () { if (opener) opener.focus(); });
    var pw = dlg.querySelector("[data-pw]");
    if (pw) pw.addEventListener("click", function () {
      var input = pw.parentElement.querySelector("input");
      input.type = input.type === "password" ? "text" : "password";
      pw.textContent = input.type === "password" ? "Göster" : "Gizle";
    });
    // Telefon yazarken 05xx xxx xx xx biçimine girer (+90 ya da baştaki 0 olsa da olmasa da)
    var tel = dlg.querySelector("input[name=telefon]");
    if (tel) tel.addEventListener("input", function () {
      var d = tel.value.replace(/\D/g, "").replace(/^90(?=5)/, "").replace(/^0/, "").slice(0, 10);
      var out = d ? "0" + d.slice(0, 3) : "";
      if (d.length > 3) out += " " + d.slice(3, 6);
      if (d.length > 6) out += " " + d.slice(6, 8);
      if (d.length > 8) out += " " + d.slice(8, 10);
      tel.value = out;
    });
    var form = dlg.querySelector("form");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var err = form.querySelector("[data-err]");
      var msg = "";
      var bad = function (input, text) { input.classList.add("bad"); if (!msg) msg = text; };
      form.querySelectorAll(".bad").forEach(function (i) { i.classList.remove("bad"); });
      var f = form.elements;
      if (f.ad && f.ad.value.trim().split(/\s+/).length < 2) bad(f.ad, "Adınızı ve soyadınızı yazın.");
      if (f.dukkan && !f.dukkan.value.trim()) bad(f.dukkan, "Dükkân adını yazın.");
      var digits = f.telefon ? f.telefon.value.replace(/\D/g, "").replace(/^90/, "").replace(/^0/, "") : "";
      if (f.telefon && !/^5\d{9}$/.test(digits)) bad(f.telefon, "Cep telefonu numaranızı 05xx xxx xx xx biçiminde yazın.");
      if (f.eposta && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.eposta.value.trim())) bad(f.eposta, "Geçerli bir e-posta adresi yazın.");
      if (f.parola && f.parola.value.length < 8) bad(f.parola, "Şifre en az 8 karakter olmalı.");
      if (f.onay && !f.onay.checked) { if (!msg) msg = "Devam etmek için onay kutusunu işaretleyin."; }
      err.textContent = msg;
      err.hidden = !msg;
      if (msg) { var first = form.querySelector(".bad"); if (first) first.focus(); return; }
      form.querySelector(".m-form").hidden = true;
      form.querySelector(".m-done").hidden = false;
    });
  });
  // Kart şeridi: yatay kaydırması olmayanlar için ok düğmeleri
  var rail = document.querySelector(".d-cards");
  var arrows = document.querySelectorAll(".d-arrow");
  if (rail && arrows.length) {
    var sync = function () {
      var max = rail.scrollWidth - rail.clientWidth - 2;
      arrows[0].disabled = rail.scrollLeft <= 2;
      arrows[1].disabled = rail.scrollLeft >= max;
    };
    arrows.forEach(function (b) {
      b.addEventListener("click", function () {
        var card = rail.querySelector(".d-card");
        var step = card ? card.getBoundingClientRect().width + 20 : rail.clientWidth * .8;
        rail.scrollBy({ left: step * Number(b.dataset.dir), behavior: "smooth" });
      });
    });
    rail.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    sync();
  }
})();
