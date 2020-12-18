const express = require("express");
const router = express.Router();
const MAGIC_PUBLISHABLE_KEY = process.env.MAGIC_PUBLISHABLE_KEY;

const DatabunkerStore = require('@databunker/store');
const databunker = new DatabunkerStore({
  url: process.env.DATABUNKER_URL,
  token: process.env.DATABUNKER_TOKEN
});

/* 1️⃣ Setup Magic Admin SDK */
const { Magic } = require("@magic-sdk/admin");
const magic = new Magic(process.env.MAGIC_SECRET_KEY);

/* 2️⃣ Implement Auth Strategy */
const passport = require("passport");
const MagicStrategy = require("passport-magic").Strategy;

const strategy = new MagicStrategy(async function(user, done) {
  const userMetadata = await magic.users.getMetadataByIssuer(user.issuer);
  const existingUser = await databunker.users.get("email", userMetadata.email);
  if (!existingUser.data) {
    // do not automatically register users here
    // return signup(user, userMetadata, done);
    return done(null, false, {
      message: `User record was not found. You need to register first.`
    });
  } else {
    /* Login user if otherwise */
    return login(user, existingUser, done);
  }
});

passport.use(strategy);

/* No not automatically signup user, we have a register code above */
/*
const signup = async (user, userMetadata, done) => {
  let newUser = {
    issuer: user.issuer,
    email: userMetadata.email,
    lastLoginAt: user.claim.iat
  };
  const result = await databunker.users.create(newUser);
  const returnUser = {
    token: result.token,
    issuer: user.issuer
  };
  return done(null, returnUser);
};
*/

/* Implement User Login */
const login = async (user, existingUser, done) => {
  /* Replay attack protection (https://go.magic.link/replay-attack) */
  if (existingUser.data.lastLoginAt && user.claim.iat <= existingUser.data.lastLoginAt) {
    return done(null, false, {
      message: `Replay attack detected for user ${user.issuer}}.`
    });
  }
  await databunker.users.set("token", existingUser.token,
    { lastLoginAt: user.claim.iat }
  );
  const returnUser = {
    token: existingUser.token,
    issuer: user.issuer
  };
  return done(null, returnUser);
};

router.get('/register', (req, res) => {
    let errors = [];
    res.render('register', {errors, name:'', email: '', company: ''})
});

router.post('/register', async (req, res) => {
    let errors = [];
    if (!req.body.name) {
        errors.push({ text: 'Please Enter Name' });
    }
    if (!req.body.email) {
        errors.push({ text: 'Please Enter Email' });
    }
    if (!req.body.company) {
        errors.push({ text: 'Please Enter Company' });
    }
    const existingUser = await databunker.users.get("email", req.body.email);
    if (existingUser.data) {
        errors.push({ text: 'Email Already Exists'} );
    }
    if (errors.length > 0) {
        res.render('register', {
            errors: errors,
            name: req.body.name,
            email: req.body.email,
            company: req.body.company
        });
	return;
    }
    const user = {
        name: req.body.name,
        email: req.body.email,
        company: req.body.company
    };
    const result = await databunker.users.create(user);
    if (result.status == "ok") {
        res.redirect('/user/login');
    } else {
        errors.push({ text: result.message } );
        res.render('register', {
            errors: errors,
            name: req.body.name,
            email: req.body.email,
            company: req.body.company
        });
    }
});

router.get('/login', (req, res) => {
    res.render("login", { title: "Magic Apple Store 🍎", MAGIC_PUBLISHABLE_KEY });
});

/* Attach middleware to login endpoint */
router.post("/login", passport.authenticate("magic"), (req, res) => {
  if (req.user) {
      res.status(200).end('User is logged in.');
  } else {
     return res.status(401).end('Could not log user in.');
  }
});

/* 4️⃣ Implement Session Behavior */

/* Defines what data are stored in the user session */
passport.serializeUser((user, done) => {
  const userSerialized = {
    token: user.token,
    issuer: user.issuer
  }
  done(null, userSerialized);
});

/* Populates user data in the req.user object */
passport.deserializeUser(async (user, done) => {
  done(null, user);
});

/* 5️⃣ Implement User Endpoints */

/* Implement Get Data Endpoint */
router.get("/me", async (req, res) => {
  if (req.isAuthenticated()) {
    const data = await databunker.collection("data").get("token", req.user.token);
    const j = {...req.user,
      appleCount: ((data.data && data.data.appleCount)? data.data.appleCount : 0)
    };
    return res
      .status(200)
      .json(j)
      .end();
  } else {
    return res.status(401).end(`User is not logged in.`);
  }
});

/* Implement Buy Apple Endpoint */
router.post("/buy-apple", async (req, res) => {
  if (req.isAuthenticated()) {
    const data = await databunker.collection("data").get("token", req.user.token);
    await databunker.collection("data").set("token", req.user.token,
      {appleCount: ((data.data && data.data.appleCount)? data.data.appleCount +1 : 1)}
      //[{ "op": "add", "path": "/appleCount", "value": 1}]
    ); 
    return res.status(200).end();
  } else {
    return res.status(401).end(`User is not logged in.`);
  }
});

/* Implement Logout Endpoint */
router.post("/logout", async (req, res) => {
  if (req.isAuthenticated()) {
    await magic.users.logoutByIssuer(req.user.issuer);
    req.logout();
    return res.status(200).end();
  } else {
    return res.status(401).end(`User is not logged in.`);
  }
});

module.exports = router;
