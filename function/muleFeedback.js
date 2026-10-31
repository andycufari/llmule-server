// @desc POST /api/muleFeedback — comments on a model card (the Feedback tab of /m/nick/model)
// { nick, model }                       → newest first (public). Authors by nick, never by email
// { op: 'post', nick, model, text }     → comment (session). 2–1000 chars, 10 per hour per person
// { op: 'delete', id }                  → the author, or whoever shares the model, removes a comment
var MAX_TEXT = 1000;
var PER_HOUR = 10;

var json = function(app, obj, status) {
  // Raw body: the text is shown as plain text by the page, never as HTML
  return app.response(JSON.stringify(obj), status || 200, { contentType: 'application/json' });
};

var fail = function(app, status, message, code) {
  return json(app, { error: { message: message, code: code || null } }, status);
};

var plain = function(r) {
  return r && typeof r.getValues === 'function' ? r.getValues() : r;
};

var idOf = function(r) {
  return '' + (r._id || r.id);
};

var sessionUser = async function(app) {
  var email = app.auth && app.auth.isAuthenticated && app.auth.user && app.auth.user.email;
  if (!email) return null;
  email = ('' + email).trim();
  var users = app.db.use('mule_users', true);
  var me = plain(await users.query({ email: email }).first()) || plain(await users.query({ email: email.toLowerCase() }).first());
  if (!me) {
    me = plain(await users.add({
      email: email.toLowerCase(), apiKey: 'llm_' + app.crypto.randomToken(), status: 'active',
      legacyId: '', uses: 0, served: 0, createdMs: Date.now()
    }));
  }
  return me && me.status !== 'blocked' ? me : null;
};

async function muleFeedback(app) {
  if (app.method !== 'POST') return fail(app, 405, 'Use POST');
  var p = app.params || {};
  var users = app.db.use('mule_users', true);
  var feedback = app.db.use('mule_feedback', true);

  if (p.op === 'delete') {
    var who = await sessionUser(app);
    if (!who) return fail(app, 401, 'Log in first', 'login_required');
    var row = typeof p.id === 'string' ? plain(await feedback.getById(p.id)) : null;
    if (!row) return fail(app, 404, 'No such comment', 'not_found');
    if (row.userId !== idOf(who) && row.ownerId !== idOf(who)) return fail(app, 403, 'Not yours to delete', 'forbidden');
    await feedback.deleteById(p.id);
    return json(app, { ok: true });
  }

  var nick = typeof p.nick === 'string' ? p.nick.trim().toLowerCase().slice(0, 20) : '';
  var model = typeof p.model === 'string' ? p.model.trim().slice(0, 120) : '';
  if (!nick || !model) return fail(app, 400, 'nick and model are required', 'bad_request');
  var owner = plain(await users.query({ nick: nick }).first());
  if (!owner) return fail(app, 404, 'Nobody goes by "' + nick + '" on LLMule', 'not_found');

  var viewer = await sessionUser(app);
  if (p.op === 'post') {
    var me = viewer;
    if (!me) return fail(app, 401, 'Log in first', 'login_required');
    var text = typeof p.text === 'string' ? p.text.replace(/\r\n/g, '\n').trim().slice(0, MAX_TEXT) : '';
    if (text.length < 2) return fail(app, 400, 'Write something first', 'empty');
    var hourAgo = Date.now() - 3600000;
    var recent = (await feedback.query({ userId: idOf(me) }).orderBy('createdMs', 'desc').limit(PER_HOUR))
      .filter(function(f) { return f.createdMs > hourAgo; });
    if (recent.length >= PER_HOUR) return fail(app, 429, 'That is a lot of feedback for one hour — try again later', 'rate_limited');
    await feedback.add({ ownerId: idOf(owner), model: model, userId: idOf(me), text: text, createdMs: Date.now() });
  }

  var rows = await feedback.query({ ownerId: idOf(owner), model: model }).orderBy('createdMs', 'desc').limit(200);
  var nicks = {};
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var f = plain(rows[i]);
    if (!(f.userId in nicks)) {
      var u = await users.getById(f.userId);
      nicks[f.userId] = (u && u.nick) || null;
    }
    out.push({
      id: idOf(f),
      nick: nicks[f.userId] || 'anonymous',
      isOwnerOfModel: f.userId === idOf(owner),
      text: f.text,
      createdMs: f.createdMs,
      canDelete: !!(viewer && (f.userId === idOf(viewer) || idOf(owner) === idOf(viewer)))
    });
  }
  return json(app, { comments: out, count: out.length, loggedIn: !!viewer });
}
