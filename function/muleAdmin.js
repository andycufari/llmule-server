// @desc POST /api/muleAdmin — import users and look at the network. Gated by X-API-Key = env MULE_ADMIN_KEY (setting/api.json)
// { op: 'upsertUsers', users: [{ email, apiKey, legacyId, uses, served }] } → keeps the key if the email exists
// { op: 'createUser', email } → new user with a fresh llm_ key (app.crypto)
// { op: 'setUser', email, nick?, served? } → admin fixes
// { op: 'stats' } → users, providers online, jobs by status
var json = function(app, obj, status) {
  return app.response(JSON.stringify(obj), status || 200, { contentType: 'application/json' });
};

var idOf = function(r) {
  return '' + (r._id || r.id);
};

async function muleAdmin(app) {
  var p = app.params || {};

  if (p.op === 'upsertUsers') {
    var users = app.db.use('mule_users', true);
    var list = Array.isArray(p.users) ? p.users.slice(0, 300) : [];
    var added = 0, updated = 0, bad = 0;
    for (var i = 0; i < list.length; i++) {
      var u = list[i] || {};
      if (typeof u.email !== 'string' || typeof u.apiKey !== 'string' || u.apiKey.indexOf('llm_') !== 0) { bad++; continue; }
      var row = await users.query({ email: u.email }).first();
      var data = { email: u.email, apiKey: u.apiKey, status: 'active', legacyId: u.legacyId || '', uses: u.uses || 0, served: u.served || 0 };
      if (row) { await users.update(idOf(row), data); updated++; }
      else { await users.add(data); added++; }
    }
    return json(app, { ok: true, added: added, updated: updated, bad: bad });
  }

  if (p.op === 'createUser') {
    var all = app.db.use('mule_users', true);
    if (typeof p.email !== 'string' || p.email.indexOf('@') < 1) return json(app, { error: 'email required' }, 400);
    var email = p.email.trim().toLowerCase();
    if (await all.query({ email: email }).first()) return json(app, { error: 'user exists' }, 409);
    var apiKey = 'llm_' + app.crypto.randomToken();
    await all.add({ email: email, apiKey: apiKey, status: 'active', legacyId: '', uses: 0, served: 0 });
    return json(app, { ok: true, email: email, apiKey: apiKey });
  }

  if (p.op === 'setUser') {
    // Admin fixes: a nick for the anchor (skips the reserved list), or zeroing served from test runs
    var us = app.db.use('mule_users', true);
    var target = await us.query({ email: p.email }).first();
    if (!target) return json(app, { error: 'no such user' }, 404);
    var patch = {};
    if (typeof p.nick === 'string') patch.nick = p.nick.trim().toLowerCase();
    if (typeof p.served === 'number') patch.served = p.served;
    await us.update(idOf(target), patch);
    return json(app, { ok: true, email: p.email, set: patch });
  }

  if (p.op === 'stats') {
    var cutoff = Date.now() - 30000;
    var online = (await app.db.use('mule_providers', true).query({}).orderBy('lastSeenMs', 'desc').limit(200))
      .filter(function(o) { return o.lastSeenMs > cutoff; });
    var jobs = app.db.use('mule_jobs', true);
    var byStatus = {};
    var statuses = ['queued', 'running', 'done', 'error', 'expired'];
    for (var s = 0; s < statuses.length; s++) {
      byStatus[statuses[s]] = await jobs.query({ status: statuses[s] }).count();
    }
    return json(app, {
      users: await app.db.use('mule_users', true).query({}).count(),
      online: online.map(function(o) { return { name: o.name, models: o.models, served: o.served, seenAgoMs: Date.now() - o.lastSeenMs }; }),
      jobs: byStatus
    });
  }

  if (p.op === 'providers') {
    // Unfiltered, newest first — to debug who registered and when
    var rows = await app.db.use('mule_providers', true).query({}).orderBy('lastSeenMs', 'desc').limit(50);
    return json(app, { now: Date.now(), rows: rows });
  }

  return json(app, { error: 'op must be upsertUsers, stats or providers' }, 400);
}
