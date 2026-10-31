// @desc GET /api/muleNetwork — public picture of the network: models online, who shares, top sharers. No auth, no emails
var ONLINE_MS = 30000;

var json = function(app, obj, status) {
  return app.response(JSON.stringify(obj), status || 200, { contentType: 'application/json' });
};

var idOf = function(r) {
  return '' + (r._id || r.id);
};

async function muleNetwork(app) {
  // The site's cache has a quota (100/min, 1000/h, 10000/day per site) and over it get() THROWS: every
  // page's status bar polls this, so the cache is a nice-to-have, never a reason to fail
  var cached = null;
  try { cached = await app.cache.get('muleNetwork'); } catch (e) { cached = null; }
  if (cached) return json(app, cached);

  var now = Date.now();
  var users = app.db.use('mule_users', true);
  // .gt() on lastSeenMs came back empty with fresh rows — newest first + filter here
  var rows = await app.db.use('mule_providers', true).query({}).orderBy('lastSeenMs', 'desc').limit(200);
  var online = rows.filter(function(p) { return p.lastSeenMs > now - ONLINE_MS; });

  // userId → public nick (never the email)
  var nicks = {};
  var nickOf = async function(userId) {
    if (!(userId in nicks)) {
      var u = await users.getById(userId);
      nicks[userId] = (u && u.nick) || null;
    }
    return nicks[userId];
  };

  var models = {};
  var sharers = [];
  for (var i = 0; i < online.length; i++) {
    var p = online[i];
    var nick = await nickOf(p.userId);
    (p.models || []).forEach(function(m) {
      if (!models[m]) models[m] = { id: m, providers: 0, by: [] };
      models[m].providers++;
      if (nick && models[m].by.indexOf(nick) === -1) models[m].by.push(nick);
    });
    sharers.push({ nick: nick || 'anonymous', machine: p.name || '', models: p.models || [] });
  }

  // Model cards (llmule.xyz/m/nick/model): written ones stay listed while offline; online ones show up
  // even before their owner writes anything. Anonymous sharers (no nick) have no page.
  var seen = {};
  rows.forEach(function(p) {
    (p.models || []).forEach(function(m) {
      var k = p.userId + '\n' + m;
      if (!seen[k] || p.lastSeenMs > seen[k]) seen[k] = p.lastSeenMs;
    });
  });
  var isOn = function(k) { return seen[k] > now - ONLINE_MS; };
  var blurb = function(md) {
    var t = String(md || '').replace(/```[\s\S]*?```/g, ' ').replace(/[#>*_`\[\]]|\(http[^)]*\)/g, '').replace(/\s+/g, ' ').trim();
    return t.length > 180 ? t.slice(0, 177) + '…' : t;
  };
  var shared = [];
  var listed = {};
  var cardRows = await app.db.use('mule_cards', true).query({}).orderBy('likeCount', 'desc').limit(300);
  for (var c = 0; c < cardRows.length; c++) {
    var card = cardRows[c];
    var k = card.ownerId + '\n' + card.model;
    var written = !!(card.title || card.description);
    if (!written && !isOn(k)) continue;
    var cnick = await nickOf(card.ownerId);
    if (!cnick) continue;
    listed[k] = true;
    shared.push({
      id: cnick + '/' + card.model, nick: cnick, model: card.model, title: card.title || '', blurb: blurb(card.description),
      hardware: card.hardware || '', likes: card.likeCount || 0, answered: card.answered || 0,
      tokPerSec: card.msSum > 0 && card.tokSum > 0 ? Math.round((card.tokSum / (card.msSum / 1000)) * 10) / 10 : null,
      online: isOn(k), lastSeenMs: seen[k] || null
    });
  }
  for (var o = 0; o < online.length; o++) {
    var op = online[o];
    var onick = await nickOf(op.userId);
    if (!onick) continue;
    (op.models || []).forEach(function(m) {
      var key = op.userId + '\n' + m;
      if (listed[key]) return;
      listed[key] = true;
      shared.push({ id: onick + '/' + m, nick: onick, model: m, title: '', blurb: '', hardware: '', likes: 0, answered: 0, tokPerSec: null, online: true, lastSeenMs: seen[key] });
    });
  }
  shared.sort(function(a, b) {
    return (b.online - a.online) || (b.likes - a.likes) || ((b.title ? 1 : 0) - (a.title ? 1 : 0)) || (b.answered - a.answered);
  });

  // Leaderboard: completions served, per user (a person can run several machines)
  var top = await users.query({}).orderBy('served', 'desc').limit(20);
  var leaderboard = top
    .filter(function(u) { return (u.served || 0) > 0; })
    .map(function(u) { return { nick: u.nick || 'anonymous', served: u.served || 0 }; });

  var jobs = app.db.use('mule_jobs', true);
  var out = {
    online: { models: Object.keys(models).length, machines: online.length },
    models: Object.keys(models).sort().map(function(k) { return models[k]; }),
    sharers: sharers,
    cards: shared.slice(0, 100),
    leaderboard: leaderboard,
    totals: { users: await users.query({}).count(), answered: await jobs.query({ status: 'done' }).count() },
    at: now
  };
  try { await app.cache.set('muleNetwork', out, 10); } catch (e) { /* over quota: serve it uncached */ }
  return json(app, out);
}
