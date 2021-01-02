const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
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

// Prepare a custom variable to be printed in the log line :sessionid
morgan.token("sessionid", function(req, res) {
  if (req.sessionID) {
    return req.sessionID;
  }
});

// Prepare a custom variable to be printed in the log line :usertoken
morgan.token("usertoken", function(req, res) {
  if (req.user && req.user.token){
    return req.user.token;
  }
});

const app = express();
app.set("trust proxy", 1);
app.set("view engine", "ejs");

app.use(morgan(':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" ":sessionid" ":usertoken"'))
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
