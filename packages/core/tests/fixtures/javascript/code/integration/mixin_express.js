var proto = require('./mixin_application');
var mixin = require('merge-descriptors');

function createApplication() {
  var app = function (req, res, next) {
    app.handle(req, res, next);
  };
  mixin(app, proto, false);
  return app;
}

exports = module.exports = createApplication;
