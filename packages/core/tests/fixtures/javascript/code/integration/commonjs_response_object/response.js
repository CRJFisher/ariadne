// The expressjs `lib/response.js` shape: a module-scope `res` object exported
// whole, methods attached as named function expressions, one of which shadows
// the module-scope `res` with a function-local `var res = this;`.
var res = {};

module.exports = res;

res.sendFile = function sendFile(path, options, callback) {
  var res = this;
  var done = callback || function () {};
  var opts = options || {};
  sendfile(res, path, opts, done);
};

res.sendfile = function sendfile(path, options) {
  var res = this;
  var opts = options || {};
  sendfile(res, path, opts, function () {});
};

res.append = function append(field, val) {
  var prev = this.get(field);
  var value = prev ? [prev, val] : val;
  return this.set(field, value);
};

res.location = function location(url) {
  return this.set("Location", url);
};

res.json = function json(obj) {
  var body = stringify(obj, null, 2, true);
  return this.send(body);
};

function sendfile(res, file, options, callback) {
  callback(res, file, options);
}

function stringify(value, replacer, spaces, escape) {
  var json = JSON.stringify(value, replacer, spaces);
  return escape ? json.replace(/[<>&]/g, "-") : json;
}
