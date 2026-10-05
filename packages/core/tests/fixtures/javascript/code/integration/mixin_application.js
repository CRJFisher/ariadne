var app = exports = module.exports = {};

app.engine = function engine(ext, fn) {
  this.engines[ext] = fn;
  return this;
};

app.set = function set(setting, val) {
  this.settings[setting] = val;
  return this;
};
