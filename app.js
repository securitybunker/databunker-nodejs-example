const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const session = require("express-session");
const passport = require("passport");
const { v4: uuidv4 } = require('uuid');
const DataBunkerSessionStore = require('@databunker/session-store')(session);

const indexRouter = require("./routes/index");
const userRouter = require("./routes/user");

const DataBunkerConf = {
  url: process.env.DATABUNKER_URL,
  token: process.env.DATABUNKER_TOKEN
};

const s = session({
  genid: function(req) {
    return uuidv4();
  },
  secret: 'JustASecret',
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 60 * 60 * 1000, // 1 hour
    // secure: true, // Uncomment this line to enforce HTTPS protocol.
    sameSite: true
  },
  store: new DataBunkerSessionStore(DataBunkerConf)
});

const app = express();
app.set("trust proxy", 1);
app.set("view engine", "ejs");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(s);
app.use(passport.initialize());
app.use(passport.session());

app.use("/", indexRouter);
app.use("/user", userRouter);

const listener = app.listen(8080, function() {
  console.log("Listening on port " + listener.address().port);
});
