// @desc GET /api/muleNetwork — public picture of the network: models online, who shares, top sharers. No auth, no emails
var ONLINE_MS = 30000;

var json = function(app, obj, status) {
  return app.response(JSON.stringify(obj), status || 200, { contentType: 'application/json' });
};

var idOf = function(r) {
  return '' + (r._id || r.id);
};

async function muleNetwork(app) {
  var cached = await app.cache.get('muleNetwork');
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
    leaderboard: leaderboard,
    totals: { users: await users.query({}).count(), answered: await jobs.query({ status: 'done' }).count() },
    at: now
  };
  await app.cache.set('muleNetwork', out, 10);
  return json(app, out);
}
