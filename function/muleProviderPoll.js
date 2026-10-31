// @desc POST /provider/poll — a provider says "I'm here with these models" and waits (long poll) for a job
// Body: { instance, name, models: [...] }. Answers { job: { id, request } } or { job: null } after ~20s.
// Polling is the heartbeat: no sockets, works behind any NAT.
// { instance, bye: true } → the process is stopping: never offer it another job (its last long poll is
// still running here and would take one for nobody), and muleChat re-queues a job it was holding.
var HOLD_MS = 20000;
var BEAT_MS = 5000;

var json = function(app, obj, status) {
  return app.response(JSON.stringify(obj), status || 200, { contentType: 'application/json' });
};

var fail = function(app, status, message) {
  return json(app, { error: { message: message, type: 'llmule_error' } }, status);
};

var plain = function(r) {
  return r && typeof r.getValues === 'function' ? r.getValues() : r;
};

var idOf = function(r) {
  return '' + (r._id || r.id);
};

var whoIs = async function(app) {
  var h = app.request && app.request.headers;
  if (!h) return null;
  var auth = h.get('authorization') || '';
  var key = auth.indexOf('Bearer ') === 0 ? auth.slice(7).trim() : (h.get('x-api-key') || '').trim();
  if (!key) return null;
  return await app.db.use('mule_users', true).query({ apiKey: key, status: 'active' }).first();
};

async function muleProviderPoll(app) {
  if (app.method !== 'POST') return fail(app, 405, 'Use POST');
  var user = await whoIs(app);
  if (!user) return fail(app, 401, 'Missing or invalid API key');

  var p = app.params || {};
  var instance = typeof p.instance === 'string' ? p.instance.slice(0, 64) : '';
  if (instance.length < 8) return fail(app, 400, 'instance is required (random id, 8+ chars)');
  if (p.bye === true) {
    var leaving = plain(await app.db.use('mule_providers', true).query({ instance: instance }).first());
    if (leaving && leaving.userId === idOf(user)) {
      await app.db.use('mule_providers', true).update(idOf(leaving), { lastSeenMs: 0, goneMs: Date.now() });
    }
    return json(app, { ok: true });
  }
  var models = Array.isArray(p.models) ? p.models.filter(function(m) { return typeof m === 'string' && m && m.length <= 120; }).slice(0, 50) : [];
  if (!models.length) return fail(app, 400, 'models is required');
  var name = typeof p.name === 'string' ? p.name.slice(0, 60) : '';

  var providers = app.db.use('mule_providers', true);
  var row = await providers.query({ instance: instance }).first();
  if (row && row.userId !== idOf(user)) return fail(app, 403, 'instance belongs to another user');
  var providerId;
  if (row) {
    providerId = idOf(row);
    await providers.update(providerId, { models: models, name: name, lastSeenMs: Date.now() });
  } else {
    providerId = idOf(plain(await providers.add({ userId: idOf(user), instance: instance, name: name, models: models, lastSeenMs: Date.now(), served: 0 })));
  }

  var jobs = app.db.use('mule_jobs', true);
  var start = Date.now();
  var beat = start;
  // This poll can outlive its process (stopped mid-poll): before taking a job or beating, check it didn't say bye
  var gone = async function() {
    var me = plain(await providers.getById(providerId));
    return !me || !!me.goneMs;
  };
  while (Date.now() - start <= HOLD_MS) {
    var job = await jobs.query({ providerId: providerId, status: 'queued' }).orderBy('createdMs', 'asc').first();
    if (job) {
      if (await gone()) return json(app, { job: null });
      var jobId = idOf(job);
      await jobs.update(jobId, { status: 'running', runningBy: instance, startedMs: Date.now() });
      return json(app, { job: { id: jobId, request: JSON.parse(job.request) } });
    }
    if (Date.now() - beat > BEAT_MS) {
      if (await gone()) return json(app, { job: null });
      beat = Date.now();
      await providers.update(providerId, { lastSeenMs: beat });
    }
    await app.sleep(1000);
  }
  return json(app, { job: null });
}
