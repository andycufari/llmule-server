// @desc POST /provider/result — the provider hands back the answer (or the error) of a job it picked up
// Body: { instance, jobId, response } or { instance, jobId, error }. response = the OpenAI chat.completion JSON.
var MAX_RESULT = 1000000;

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

async function muleProviderResult(app) {
  if (app.method !== 'POST') return fail(app, 405, 'Use POST');
  var user = await whoIs(app);
  if (!user) return fail(app, 401, 'Missing or invalid API key');

  var p = app.params || {};
  if (typeof p.jobId !== 'string' || typeof p.instance !== 'string') return fail(app, 400, 'jobId and instance are required');

  var jobs = app.db.use('mule_jobs', true);
  var job = plain(await jobs.getById(p.jobId));
  if (!job) return fail(app, 404, 'No such job');
  // Only the instance that picked it up, and only while the consumer is still waiting
  if (job.runningBy !== p.instance || job.providerUserId !== idOf(user)) return fail(app, 403, 'Not your job');
  if (job.status !== 'running') return json(app, { ok: false, late: true, status: job.status });

  if (p.error !== undefined || !p.response || typeof p.response !== 'object') {
    await jobs.update(p.jobId, { status: 'error', error: ('' + (p.error || 'empty response')).slice(0, 500), finishedMs: Date.now() });
    return json(app, { ok: true });
  }

  var result = JSON.stringify(p.response);
  if (result.length > MAX_RESULT) {
    await jobs.update(p.jobId, { status: 'error', error: 'response too large', finishedMs: Date.now() });
    return fail(app, 413, 'response too large');
  }
  await jobs.update(p.jobId, { status: 'done', result: result, finishedMs: Date.now() });

  // Serving yourself doesn't climb the leaderboard
  if (job.userId !== idOf(user)) {
    await app.db.use('mule_users', true).update(idOf(user), { served: (user.served || 0) + 1 });
  }
  var provider = await app.db.use('mule_providers', true).query({ instance: p.instance }).first();
  if (provider) await app.db.use('mule_providers', true).update(idOf(provider), { served: (provider.served || 0) + 1 });
  return json(app, { ok: true });
}
