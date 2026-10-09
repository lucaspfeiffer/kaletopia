// Kaletopia. Keeps the paper's date and "on this day" true to the reader's day,
// since the pages themselves are built ahead of time.
(function () {
  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var today = new Date();
  var long = DAYS[today.getDay()] + ', ' + MONTHS[today.getMonth()] + ' ' + today.getDate() + ', ' + today.getFullYear();
  document.querySelectorAll('[data-today], [data-today-long]').forEach(function (el) { el.textContent = long; });

  var otd = document.querySelector('[data-on-this-day]');
  if (!otd) return;
  // Find the site root from the stylesheet link, which is always root-relative.
  var css = document.querySelector('link[rel="stylesheet"][href$="assets/css/site.css"]');
  var root = css ? css.getAttribute('href').replace(/assets\/css\/site\.css$/, '') : '';
  fetch(root + 'api/entries.json').then(function (r) { return r.json(); }).then(function (data) {
    var m = today.getMonth() + 1, d = today.getDate();
    function parts(s) { var p = s.replace(/^-/, '').split('-').map(Number); return { year: s[0] === '-' ? -p[0] : p[0], month: p[1], day: p[2] }; }
    var todays = data.entries.filter(function (e) { if (!e.when) return false; var w = parts(e.when.start); return w.month === m && w.day === d; });
    var monthly = data.entries.filter(function (e) { if (!e.when) return false; var w = parts(e.when.start); return w.month === m && w.day !== d; });
    var inGrid = !!otd.querySelector('.grid');
    function cardHtml(e, small) {
      var years = today.getFullYear() - parts(e.when.start).year;
      var href = root + 'entries/' + e.slug + '/';
      return '<article class="card ' + (small ? 'small' : 'standard') + '">' +
        (!small && e.hero ? '<a href="' + href + '" class="hero"><img src="' + root + e.hero.src + '" alt="' + esc(e.hero.alt) + '" loading="lazy"></a>' : '') +
        '<p class="kicker note">' + years + ' years ago</p>' +
        '<h3><a href="' + href + '">' + esc(e.title) + '</a></h3>' +
        (small ? '' : '<p class="summary">' + esc(e.summary) + '</p>') +
        '<p class="label meta">' + (e.media.indexOf('simulation') >= 0 ? '<span class="interactive">Interactive</span>' : '') + '<span>' + e.minutes + ' min read</span></p></article>';
    }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function render(section, list, emptyText) {
      if (!section) return;
      var head = section.querySelector('.section-head');
      var title = head ? head.outerHTML : '';
      if (!list.length) { section.innerHTML = title + '<p class="empty">' + emptyText + '</p>'; return; }
      var small = !inGrid;
      var items = list.map(function (e) { return cardHtml(e, small); });
      section.innerHTML = title + (inGrid ? '<div class="grid">' + items.join('') + '</div>' : items.join('<hr class="rule">'));
    }
    render(otd, todays, 'Nothing in the archive for ' + MONTHS[m - 1] + ' ' + d + ' yet.');
    var tm = document.querySelector('[data-this-month]');
    if (tm) render(tm, monthly, 'Nothing yet for ' + MONTHS[m - 1] + '.');
  }).catch(function () {});
})();
