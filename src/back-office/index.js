// BACK OFFICE
const express = require('express')
const bodyParser = require('body-parser')
const https = require("https")
const fs = require("fs")
const helmet = require("helmet")
const app = express()
const client = require("../front-office/configs/database")
const bcrypt = require('bcrypt')
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const aux = require("./aux")
const { register } = require("./register")
const { bo_accessLogger, bo_errorLogger } = require("../front-office/logger")

// passport configuration
const initializePassport = require('./passport-config')
initializePassport(
  passport,
  aux.getUserByEmail,
  aux.getUserById
)

app.use(express.urlencoded({ extended: false }))
// use flash for error messages
app.use(flash())
// session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: true,
  },
  saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())

const PORT = 8081
const host = '192.168.1.4'

// read private key and certificate for https
const options = {
  key: fs.readFileSync("../utils/keys/private_key.pem"),
  cert: fs.readFileSync("../utils/keys/cert.pem")
};

// set EJS as view engine
app.set('view engine', 'ejs')
app.use(helmet());
app.use(bodyParser.json())

/**
 * MANTER AS FUNCIONALIDADES DE REGISTER APENAS PARA FACILITAR INSERIR DOCTORS NA BD
 * depois tiramos, nao faz muito sentido dar para registar novos medicos assim no site 
 */

// load register page
app.get('/register', checkNotAuthenticated, (request, response) => {
  response.render("register", { })
})

// register users actual functionality
app.post('/register', checkNotAuthenticated, register);


// render login page
app.get('/login', checkNotAuthenticated, (request, response) => {
  response.render("login")
})

app.get('/doctor/profile', checkAuthenticated, (request, response) => {
  request.user.then(function(user){
    response.render('profile', { name: user.name })
  })
})

app.get('/doctor/analysis', checkAuthenticated, (request, response) => {
  request.user.then(function(user){
    aux.showListAnalysisFromDoctor(user.id)
    .then(result => {
      response.render("analysis", {user: user, data: result})
    })
    .catch(error => {
      console.error(error)
    })
  })
})

app.get('/doctor/analysis/update', checkAuthenticated, (request, response) => {
  response.redirect('/doctor/analysis');
})

// login users fucntionality
// dava jeito conseguir dar log dos users que dao login
app.post('/login', checkNotAuthenticated, passport.authenticate('local', {
  successRedirect: '/doctor/profile',  // login successful -> redirect to appointments
  failureRedirect: '/login',              // login unsuccessful -> redirect to login again
  failureFlash: true                      // if login is unsuccessful display error message
}));

// log user out
app.get('/logout', checkAuthenticated, function(request, response, next) {
  request.logout(function(err) {
    if (err) { return next(err); }
    response.redirect('/login');
  });
})

/**
 * Function to check if user is authenticated
 * if user is authenticated -> allow operation
 * otherwise, redirect user to login page
 */
function checkAuthenticated(request, response, next) {
  if(request.isAuthenticated()) {
    return next()
  }
  response.redirect('/login')
}

/**
 * Function to check if user is not authenticated
 * if user is authenticated -> redirect to homepage
 * otherwise, allow operation
 */
function checkNotAuthenticated(request, response, next) {
  if (request.isAuthenticated()) {
    return response.redirect('/doctor/profile')
  }
  next()
}

// create server
https.createServer(options, app).listen(PORT, ()=>{
    bo_accessLogger.info(`Successfuly started HTTPS server on port ${PORT}`);
});
