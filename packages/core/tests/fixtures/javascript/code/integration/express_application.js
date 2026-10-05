// The expressjs `lib/application.js` shape: an `app` object exported whole,
// its methods attached as named function expressions plus one anonymous
// `render`. The trailing calls exercise dispatch through `app`, so every
// member id the `app` collection records has to name a real definition.

var app = exports = module.exports = {};

app.init = function init() {
  this.settings = {};
  this.engines = {};
};

app.engine = function engine(ext, fn) {
  if (typeof fn !== 'function') {
    throw new Error('callback function required');
  }
  var extension = ext[0] !== '.' ? '.' + ext : ext;
  this.engines[extension] = fn;
  return this;
};

app.set = function set(setting, val) {
  if (arguments.length === 1) {
    return this.settings[setting];
  }
  this.settings[setting] = val;
  return this;
};

app.render = function (name, options) {
  var view = this.engines[name];
  return view(options);
};

app.init();
app.set('view engine', 'pug');
app.engine('pug', function () {});
app.render('index', {});
