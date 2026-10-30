// @desc GET /v1/models — OpenAI-compatible list of the models that have a provider online right now (+ auto, nick/model)
var ONLINE_MS = 30000;

var json = function(app, obj, status) {
  return app.response(JSON.stringify(obj), status || 200, { contentType: 'application/json' });
};

var whoIs = async function(app) {
  var h = app.request && app.request.headers;
  if (!h) return null;
  var auth = h.get('authorization') || '';
  var key = auth.indexOf('Bearer ') === 0 ? auth.slice(7).trim() : (h.get('x-api-key') || '').trim();
  if (!key) return null;
  return await app.db.use('mule_users', true).query({ apiKey: key, status: 'active' }).first();
};

async function muleModels(app) {
  var user = await whoIs(app);
  if (!user) return json(app, { error: { message: 'Missing or invalid API key. Send Authorization: Bearer llm_...', type: 'llmule_error', code: 'invalid_api_key' } }, 401);

  // .gt() on lastSeenMs came back empty with fresh rows — newest first + filter here
  var cutoff = Date.now() - ONLINE_MS;
  var online = (await app.db.use('mule_providers', true).query({}).orderBy('lastSeenMs', 'desc').limit(200))
    .filter(function(p) { return p.lastSeenMs > cutoff; });
  // "model" (anyone), "nick/model" (that person's machines) and "auto" (the most shared one)
  var users = app.db.use('mule_users', true);
  var nicks = {};
  var count = {};
  for (var i = 0; i < online.length; i++) {
    var p = online[i];
    if (!(p.userId in nicks)) {
      var u = await users.getById(p.userId);
      nicks[p.userId] = (u && u.nick) || null;
    }
    (p.models || []).forEach(function(m) {
      count[m] = (count[m] || 0) + 1;
      if (nicks[p.userId]) {
        var pinned = nicks[p.userId] + '/' + m;
        count[pinned] = (count[pinned] || 0) + 1;
      }
    });
  }
  var ids = Object.keys(count).sort();
  if (ids.length) ids.unshift('auto');
  var data = ids.map(function(m) {
    return { id: m, object: 'model', owned_by: m.indexOf('/') > 0 ? m.split('/')[0] : 'llmule', providers: m === 'auto' ? online.length : count[m] };
  });
  return json(app, { object: 'list', data: data });
}
