// @desc POST /api/muleMe — the logged-in user's LLMule account (web session, not API key)
// {} → { email, nick, apiKey, uses, served, today, dailyLimit }. First visit creates the row; the 154 imported
//      users find theirs by email and keep their old key.
// { op: 'rotate' } → new apiKey (the old one stops working right away)
// { op: 'setNick', nick } → public name for the leaderboard and nick/model. Unique, [a-z0-9_-]{3,20}
var DAILY_LIMIT = 200;
var NICK = /^[a-z0-9_-]{3,20}$/;
var RESERVED = ['llmule', 'admin', 'anchor', 'auto', 'api', 'root', 'system', 'support'];

var json = function(app, obj, status) {
  return app.response(JSON.stringify(obj), status || 200, { contentType: 'application/json' });
};

var plain = function(r) {
  return r && typeof r.getValues === 'function' ? r.getValues() : r;
};

var idOf = function(r) {
  return '' + (r._id || r.id);
};

var today = function() {
  return new Date().toISOString().slice(0, 10);
};

var view = function(u, limit) {
  return {
    email: u.email,
    nick: u.nick || null,
    apiKey: u.apiKey,
    uses: u.uses || 0,
    served: u.served || 0,
    today: u.dayKey === today() ? (u.dayCount || 0) : 0,
    dailyLimit: limit
  };
};

async function muleMe(app) {
  if (!app.auth.isAuthenticated || !app.auth.user || !app.auth.user.email) {
    return json(app, { error: { message: 'Log in first', code: 'login_required' } }, 401);
  }
  var users = app.db.use('mule_users', true);
  var email = ('' + app.auth.user.email).trim();
  var lower = email.toLowerCase();
  var limit = Number(await app.env.get('MULE_DAILY_LIMIT', DAILY_LIMIT)) || DAILY_LIMIT;

  // Imported emails kept their original case
  var me = plain(await users.query({ email: email }).first()) || plain(await users.query({ email: lower }).first());
  if (!me) {
    me = plain(await users.add({
      email: lower, apiKey: 'llm_' + app.crypto.randomToken(), status: 'active',
      legacyId: '', uses: 0, served: 0, createdMs: Date.now()
    }));
  }
  if (me.status === 'blocked') return json(app, { error: { message: 'This account is blocked', code: 'blocked' } }, 403);

  var p = app.params || {};

  if (p.op === 'rotate') {
    var key = 'llm_' + app.crypto.randomToken();
    await users.update(idOf(me), { apiKey: key });
    me.apiKey = key;
    return json(app, view(me, limit));
  }

  if (p.op === 'setNick') {
    var nick = typeof p.nick === 'string' ? p.nick.trim().toLowerCase() : '';
    if (!NICK.test(nick)) return json(app, { error: { message: '3–20 characters: a-z, 0-9, _ or -', code: 'bad_nick' } }, 400);
    if (RESERVED.indexOf(nick) !== -1) return json(app, { error: { message: 'That nick is reserved', code: 'nick_taken' } }, 409);
    var taken = plain(await users.query({ nick: nick }).first());
    if (taken && idOf(taken) !== idOf(me)) return json(app, { error: { message: 'That nick is taken', code: 'nick_taken' } }, 409);
    await users.update(idOf(me), { nick: nick });
    me.nick = nick;
    return json(app, view(me, limit));
  }

  return json(app, view(me, limit));
}
