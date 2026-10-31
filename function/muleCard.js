// @desc POST /api/muleCard — model cards, the page behind llmule.xyz/m/nick/model
// { nick, model }                                   → the card (public). With a session: likedByMe, isOwner
// { op: 'like', nick, model }                       → toggle 👍 (session; not on your own model)
// { op: 'save', model, title, description, hardware } → write the card of YOUR nick/model (session)
// { op: 'mine' }                                    → your models: shared at some point, or with a card
var ONLINE_MS = 30000;
var MAX = { title: 80, description: 6000, hardware: 160 };
var MODEL = /^[^\s\/]{1,120}$/; // the page route is /m/:nick/:model — no slashes

var json = function(app, obj, status) {
  // Raw body: response() would run the owner's markdown through the HTML sanitizer
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

var clean = function(v, max) {
  return typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, max) : '';
};

// The logged-in person's LLMule row (created on first need, like muleMe does)
var sessionUser = async function(app, create) {
  var email = app.auth && app.auth.isAuthenticated && app.auth.user && app.auth.user.email;
  if (!email) return null;
  email = ('' + email).trim();
  var users = app.db.use('mule_users', true);
  var me = plain(await users.query({ email: email }).first()) || plain(await users.query({ email: email.toLowerCase() }).first());
  if (!me && create) {
    me = plain(await users.add({
      email: email.toLowerCase(), apiKey: 'llm_' + app.crypto.randomToken(), status: 'active',
      legacyId: '', uses: 0, served: 0, createdMs: Date.now()
    }));
  }
  return me && me.status !== 'blocked' ? me : null;
};

// When the owner's machines last served this model, and whether one is online now
var presence = async function(app, ownerId, model) {
  var rows = await app.db.use('mule_providers', true).query({ userId: ownerId }).orderBy('lastSeenMs', 'desc').limit(50);
  var last = 0;
  var sources = 0;
  var now = Date.now();
  rows.forEach(function(p) {
    if ((p.models || []).indexOf(model) === -1) return;
    if (p.lastSeenMs > last) last = p.lastSeenMs;
    if (p.lastSeenMs > now - ONLINE_MS) sources++;
  });
  return { lastSeenMs: last || null, sources: sources, online: sources > 0 };
};

var tokPerSec = function(c) {
  return c && c.msSum > 0 && c.tokSum > 0 ? Math.round((c.tokSum / (c.msSum / 1000)) * 10) / 10 : null;
};

var view = function(nick, model, card, where, me) {
  card = card || {};
  return {
    nick: nick,
    model: model,
    id: nick + '/' + model,
    title: card.title || '',
    description: card.description || '',
    hardware: card.hardware || '',
    written: !!(card.title || card.description),
    answered: card.answered || 0,
    tokPerSec: tokPerSec(card),
    likes: card.likeCount || 0,
    online: where.online,
    sources: where.sources,
    lastSeenMs: where.lastSeenMs,
    updatedMs: card.updatedMs || null,
    likedByMe: !!(me && (card.likes || []).indexOf(idOf(me)) !== -1),
    isOwner: !!(me && card.ownerId === idOf(me))
  };
};

// Public SEO index (mule_pages): one row per WRITTEN card, only public facts. The page's <title>/meta (via
// fetch_data: the framework takes the record's title/summary) and the sitemap read it. Best effort: a card never fails because of it.
var summaryOf = function(md) {
  var t = String(md || '').replace(/```[\s\S]*?```/g, ' ').replace(/^#+\s.*$/gm, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#>*_`]/g, '').replace(/\s+/g, ' ').trim();
  return t.length > 160 ? t.slice(0, 157).replace(/\s+\S*$/, '') + '…' : t;
};

var syncPage = async function(app, nick, model, card) {
  try {
    var pages = app.db.use('mule_pages', true);
    var row = plain(await pages.query({ nick: nick, model: model }).first());
    var written = !!(card && (card.title || card.description));
    if (!written) {
      if (row) await pages.deleteById(idOf(row));
      return;
    }
    // The framework uses this row's title/summary as the page's <title> and meta description as they are
    var want = {
      title: (card.title || model) + ' — ' + nick + '/' + model + ' on LLMule',
      summary: summaryOf(card.description) || ('An open model shared by ' + nick + ' on LLMule. Try it in the browser, or call it from any OpenAI-compatible app.'),
      updatedMs: card.updatedMs || Date.now()
    };
    if (!row) await pages.add(Object.assign({ nick: nick, model: model }, want));
    else if (row.title !== want.title || row.summary !== want.summary) await pages.update(idOf(row), want);
  } catch (e) {
    // SEO index is best effort
  }
};

async function muleCard(app) {
  if (app.method !== 'POST') return fail(app, 405, 'Use POST');
  var p = app.params || {};
  var cards = app.db.use('mule_cards', true);
  var users = app.db.use('mule_users', true);

  if (p.op === 'save') {
    var me = await sessionUser(app, true);
    if (!me) return fail(app, 401, 'Log in first', 'login_required');
    if (!me.nick) return fail(app, 400, 'Pick a nick first (My Key) — your models live at nick/model', 'nick_required');
    var model = clean(p.model, 120);
    if (!MODEL.test(model)) return fail(app, 400, 'Model name: up to 120 characters, no spaces or slashes', 'bad_model');
    // Only what was sent: { op: 'save', model } just makes sure the card exists
    var fields = { updatedMs: Date.now() };
    Object.keys(MAX).forEach(function(k) { if (typeof p[k] === 'string') fields[k] = clean(p[k], MAX[k]); });
    var row = plain(await cards.query({ ownerId: idOf(me), model: model }).first());
    if (row) {
      await cards.update(idOf(row), fields);
      row = Object.assign(row, fields);
    } else {
      row = plain(await cards.add(Object.assign({ ownerId: idOf(me), model: model, title: '', description: '', hardware: '', answered: 0, tokSum: 0, msSum: 0, likes: [], likeCount: 0, createdMs: Date.now() }, fields)));
    }
    await syncPage(app, me.nick, model, row);
    return json(app, view(me.nick, model, row, await presence(app, idOf(me), model), me));
  }

  if (p.op === 'mine') {
    var mine = await sessionUser(app, true);
    if (!mine) return fail(app, 401, 'Log in first', 'login_required');
    var byModel = {};
    (await cards.query({ ownerId: idOf(mine) }).limit(200)).forEach(function(c) { byModel[c.model] = plain(c); });
    (await app.db.use('mule_providers', true).query({ userId: idOf(mine) }).limit(50)).forEach(function(pr) {
      (pr.models || []).forEach(function(m) { if (!(m in byModel)) byModel[m] = null; });
    });
    var list = [];
    var names = Object.keys(byModel).sort();
    for (var i = 0; i < names.length; i++) {
      list.push(view(mine.nick || '', names[i], byModel[names[i]], await presence(app, idOf(mine), names[i]), mine));
    }
    return json(app, { nick: mine.nick || null, models: list });
  }

  // Read (and like): by nick/model
  var nick = clean(p.nick, 20).toLowerCase();
  var name = clean(p.model, 120);
  if (!nick || !name) return fail(app, 400, 'nick and model are required', 'bad_request');
  var owner = plain(await users.query({ nick: nick }).first());
  if (!owner) return fail(app, 404, 'Nobody goes by "' + nick + '" on LLMule', 'not_found');
  var card = plain(await cards.query({ ownerId: idOf(owner), model: name }).first());
  var where = await presence(app, idOf(owner), name);
  if (!card && !where.lastSeenMs) return fail(app, 404, nick + ' has never shared "' + name + '"', 'not_found');

  if (p.op === 'like') {
    var liker = await sessionUser(app, true);
    if (!liker) return fail(app, 401, 'Log in first', 'login_required');
    if (idOf(liker) === idOf(owner)) return fail(app, 400, "That's your own model", 'own_model');
    if (!card) {
      card = plain(await cards.add({ ownerId: idOf(owner), model: name, title: '', description: '', hardware: '', answered: 0, tokSum: 0, msSum: 0, likes: [], likeCount: 0, createdMs: Date.now() }));
    }
    var likes = (card.likes || []).slice();
    var at = likes.indexOf(idOf(liker));
    if (at === -1) likes.push(idOf(liker)); else likes.splice(at, 1);
    await cards.update(idOf(card), { likes: likes, likeCount: likes.length });
    card.likes = likes;
    card.likeCount = likes.length;
    return json(app, view(nick, name, card, where, liker));
  }

  // Cards written before mule_pages existed (or after a nick change) get their public row here
  if (card && (card.title || card.description)) await syncPage(app, nick, name, card);
  return json(app, view(nick, name, card, where, await sessionUser(app, false)));
}
