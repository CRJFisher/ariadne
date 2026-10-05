// The express route-registration shape: handlers are handed to the framework
// by name and never invoked at a syntactic call site.
var user = require("./user");

app.get("/users", user.list);
app.get("/user/:id/edit", user.edit);
app.post("/user/:id", { handler: user.edit });
