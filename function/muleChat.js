// @desc POST /v1/chat/completions — OpenAI-compatible. Writes a job for an online provider and waits for its answer
// The P2P table: the job is assigned to ONE provider when it's created (no claim race). If that provider
// doesn't pick it up in a few seconds, it goes to another. No providers → 503 that says so (the old server
// answered a silent 400 for months while new users kept trying).
var ONLINE_MS = 30000;   // provider seen polling in the last 30s
var WAIT_MS = 50000;     // functions die at 60s
var REASSIGN_MS = 8000;  // queued this long without being picked up → try another provider
var DAILY_LIMIT = 200;   // completions per user per UTC day (env MULE_DAILY_LIMIT) — the GPUs are volunteers'

var json = function(app, obj, status) {
  // Raw body: response() would run the LLM text through the HTML sanitizer
  return app.response(JSON.stringify(obj), status || 200, { contentType: 'application/json' });
};

var fail = function(app, status, message, code) {
  return json(app, { error: { message: message, type: 'llmule_error', code: code || null } }, status);
};

var plain = function(r) {
  return r && typeof r.getValues === 'function' ? r.getValues() : r;
};

var idOf = function(r) {
  return '' + (r._id || r.id);
};

// API key (Bearer or x-api-key) — or, without one, the web session (the chat on llmule.xyz)
var whoIs = async function(app) {
  var users = app.db.use('mule_users', true);
  var h = app.request && app.request.headers;
  var auth = (h && h.get('authorization')) || '';
  var key = auth.indexOf('Bearer ') === 0 ? auth.slice(7).trim() : ((h && h.get('x-api-key')) || '').trim();
  if (key) return plain(await users.query({ apiKey: key, status: 'active' }).first());
  var email = app.auth && app.auth.isAuthenticated && app.auth.user && app.auth.user.email;
  if (!email) return null;
  email = ('' + email).trim();
  return plain(await users.query({ email: email, status: 'active' }).first())
    || plain(await users.query({ email: email.toLowerCase(), status: 'active' }).first());
};

// The answer comes from a stranger's machine: rebuild it from the OpenAI fields, drop anything else
var num = function(v) {
  return typeof v === 'number' && v >= 0 ? Math.floor(v) : 0;
};

var completion = function(raw, jobId, model) {
  if (!raw || !Array.isArray(raw.choices) || !raw.choices.length) return null;
  var choices = raw.choices.slice(0, 8).map(function(c, i) {
    var m = (c && c.message) || {};
    var message = { role: 'assistant', content: typeof m.content === 'string' ? m.content : null };
    if (typeof m.reasoning_content === 'string') message.reasoning_content = m.reasoning_content;
    if (Array.isArray(m.tool_calls)) {
      message.tool_calls = m.tool_calls.slice(0, 32).map(function(t) {
        var f = (t && t.function) || {};
        return { id: '' + (t && t.id || ''), type: 'function', function: { name: '' + (f.name || ''), arguments: typeof f.arguments === 'string' ? f.arguments : JSON.stringify(f.arguments || {}) } };
      });
    }
    var finish = c && typeof c.finish_reason === 'string' ? c.finish_reason : 'stop';
    return { index: i, message: message, finish_reason: finish };
  });
  var u = raw.usage || {};
  return {
    id: 'chatcmpl-' + jobId,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model,
    choices: choices,
    usage: { prompt_tokens: num(u.prompt_tokens), completion_tokens: num(u.completion_tokens), total_tokens: num(u.total_tokens) }
  };
};

var onlineProviders = async function(app) {
  // .gt() on lastSeenMs came back empty with fresh rows — newest first + filter here
  var cutoff = Date.now() - ONLINE_MS;
  return (await app.db.use('mule_providers', true).query({}).orderBy('lastSeenMs', 'desc').limit(200))
    .filter(function(p) { return p.lastSeenMs > cutoff; });
};

// "model" → anyone serving it · "nick/model" → only that person's machines · "auto" → the most shared model
var resolveModel = async function(app, asked) {
  if (asked === 'auto') {
    var count = {};
    (await onlineProviders(app)).forEach(function(p) {
      (p.models || []).forEach(function(m) { count[m] = (count[m] || 0) + 1; });
    });
    var best = Object.keys(count).sort(function(a, b) { return count[b] - count[a] || (a < b ? -1 : 1); })[0];
    return best ? { model: best, ownerId: null } : null;
  }
  var slash = asked.indexOf('/');
  if (slash > 0) {
    var owner = plain(await app.db.use('mule_users', true).query({ nick: asked.slice(0, slash).toLowerCase() }).first());
    // Unknown nick: maybe a model id that has a slash in it (Org/Model)
    if (owner) return { model: asked.slice(slash + 1), ownerId: idOf(owner) };
  }
  return { model: asked, ownerId: null };
};

// Online providers serving `model`, least busy first
var pickProvider = async function(app, model, skip, ownerId) {
  var online = await onlineProviders(app);
  var withModel = online.filter(function(p) {
    return (p.models || []).indexOf(model) !== -1 && skip.indexOf(idOf(p)) === -1 && (!ownerId || p.userId === ownerId);
  });
  if (!withModel.length) return null;
  var open = await app.db.use('mule_jobs', true).query({}).in('status', ['queued', 'running']).limit(500);
  var load = {};
  open.forEach(function(j) { load[j.providerId] = (load[j.providerId] || 0) + 1; });
  withModel.sort(function(a, b) { return (load[idOf(a)] || 0) - (load[idOf(b)] || 0); });
  return withModel[0];
};

async function muleChat(app) {
  if (app.method !== 'POST') return fail(app, 405, 'Use POST');
  var user = await whoIs(app);
  if (!user) return fail(app, 401, 'Missing or invalid API key. Send Authorization: Bearer llm_...', 'invalid_api_key');

  var p = app.params || {};
  var asked = typeof p.model === 'string' ? p.model.trim() : '';
  if (!asked) return fail(app, 400, 'model is required. GET /v1/models lists what is online now, or send "auto"', 'model_required');
  if (!Array.isArray(p.messages) || !p.messages.length) return fail(app, 400, 'messages is required', 'messages_required');
  if (p.stream) return fail(app, 400, 'Streaming is not supported yet. Send stream: false', 'stream_unsupported');

  var limit = Number(await app.env.get('MULE_DAILY_LIMIT', DAILY_LIMIT)) || DAILY_LIMIT;
  var day = new Date().toISOString().slice(0, 10);
  var usedToday = user.dayKey === day ? (user.dayCount || 0) : 0;
  if (usedToday >= limit) {
    return fail(app, 429, 'Daily limit reached (' + limit + ' requests). The GPUs on LLMule are volunteers\' — it resets at 00:00 UTC. Share yours and help the network grow: https://llmule.xyz/docs#share', 'daily_limit');
  }

  var target = await resolveModel(app, asked);
  if (!target) return fail(app, 503, 'Nothing is online right now. Have a GPU? Share it: https://llmule.xyz/docs#share', 'no_provider');
  var model = target.model;
  var tried = [];
  var provider = await pickProvider(app, model, tried, target.ownerId);
  if (!provider) {
    return fail(app, 503, 'No provider is serving "' + asked + '" right now. GET /v1/models lists what is online. Have a GPU? Share it: https://llmule.xyz/docs#share', 'no_provider');
  }
  // Counted when the job is created: a request that times out still used a volunteer's GPU
  await app.db.use('mule_users', true).update(idOf(user), { dayKey: day, dayCount: usedToday + 1 });
  tried.push(idOf(provider));

  var body = { model: model, messages: p.messages };
  ['temperature', 'top_p', 'max_tokens', 'stop', 'seed', 'presence_penalty', 'frequency_penalty', 'response_format', 'tools', 'tool_choice'].forEach(function(k) {
    if (p[k] !== undefined) body[k] = p[k];
  });

  var jobs = app.db.use('mule_jobs', true);
  var start = Date.now();
  var job = plain(await jobs.add({
    userId: idOf(user),
    providerId: idOf(provider),
    providerUserId: provider.userId,
    model: model,
    request: JSON.stringify(body),
    status: 'queued',
    createdMs: start
  }));
  var jobId = idOf(job);
  var reassignAt = start + REASSIGN_MS;

  while (Date.now() - start < WAIT_MS) {
    await app.sleep(400);
    var j = plain(await jobs.getById(jobId));
    if (!j) return fail(app, 500, 'Job vanished', 'job_lost');

    if (j.status === 'done') {
      var out = completion(JSON.parse(j.result), jobId, model);
      if (!out) return fail(app, 502, 'The provider sent an answer that is not a chat completion', 'provider_error');
      await app.db.use('mule_users', true).update(idOf(user), { uses: (user.uses || 0) + 1, lastUsedMs: Date.now() });
      return json(app, out);
    }
    if (j.status === 'error') return fail(app, 502, 'The provider failed: ' + (j.error || 'unknown error'), 'provider_error');

    if (j.status === 'queued' && Date.now() > reassignAt) {
      var other = await pickProvider(app, model, tried, target.ownerId);
      if (other) {
        tried.push(idOf(other));
        await jobs.update(jobId, { providerId: idOf(other), providerUserId: other.userId });
      }
      reassignAt = Date.now() + REASSIGN_MS;
    }
  }

  await jobs.update(jobId, { status: 'expired', finishedMs: Date.now() });
  return fail(app, 504, 'No answer in ' + (WAIT_MS / 1000) + 's. Try a lower max_tokens or another model', 'timeout');
}
