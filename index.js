if (process.env.NODE_ENV !== "production") {
  require("dotenv").config()
}
const express = require('express');
const port = process.env.PORT;
const app = express();
const events = require('./bot/events');
const path = require('path');
const es6Renderer = require('express-es6-template-engine');

app.set('views', path.join(__dirname + '/dist'));
app.engine('html', es6Renderer);
app.set('view engine', 'html');

events.listenForEvents(app);

app.use(express.static('dist'));

app.listen(port, function () {
  console.log(`Listening on ${port}`);
});