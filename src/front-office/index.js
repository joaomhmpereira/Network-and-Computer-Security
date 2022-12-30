// FRONT OFFICE
const express = require('express')
const bodyParser = require('body-parser')
const https = require("https")
const fs = require("fs")
const helmet = require("helmet")
const app = express()
const client = require("./configs/database")
const bcrypt = require('bcrypt')
const crypto = require('crypto')
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const axios = require('axios')
const aux = require("./aux")
const { register } = require("./register")
const { fo_accessLogger, fo_errorLogger } = require("./logger")

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

const PORT = 8080
const host = '192.168.1.4'
const hospitalPrivKey = fs.readFileSync("../utils/keys/private_key.pem")
const hospitalPubKey = fs.readFileSync("../utils/keys/public.key")

// read private key and certificate for https
const options = {
  key: hospitalPrivKey,
  cert: fs.readFileSync("../utils/keys/cert.pem")
};

// set EJS as view engine
app.set('view engine', 'ejs')
app.use(helmet());
app.use(bodyParser.json())

// load homepage
app.get('/', (request, response) => {
  var res = axios.get('http://192.168.1.4:5000/test')
        .then(res => { return res || [] })
        .catch(error => { return error });
  res.then(function(result){
    //console.log(result.data)
    const verification = aux.processResult(result.data) 
    if(verification != false){
      aux.storeResult(result.data, verification)
    } else {
      console.log("verification failed")
    }
  })
  response.render('home')
})

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

// login users fucntionality
// dava jeito conseguir dar log dos users que dao login
app.post('/login', checkNotAuthenticated, passport.authenticate('local', {
  successRedirect: '/user/appointments',  // login successful -> redirect to appointments
  failureRedirect: '/login',              // login unsuccessful -> redirect to login again
  failureFlash: true                      // if login is unsuccessful display error message
}));

// load appointments page
app.get('/user/appointments', checkAuthenticated, (request, response) => {
  request.user.then(function(user){
    const id = user.id
    fo_accessLogger.info("User '" + id + "' (" + user.email + ") accessed /user/appointments.")
    var appointments = aux.getUserAppointments(id)
                       .then(appointments => { return appointments || []});
  
    appointments.then(function(result){
      response.render("appointments", { name: user.name, data: result })
    })  
  })
})

// load results page
app.get('/user/results', checkAuthenticated, (request, response) => {
  request.user.then(function(user){
    response.render("results", { name: user.name })
  })
})

// load profile page
app.get('/user/profile', checkAuthenticated, (request, response) => {
  request.user.then(function(user){
    response.render("profile", { name : user.name })
  })
})

// log user out
app.get('/logout', checkAuthenticated, function(request, response, next) {
  request.user.then(function(user){
    fo_accessLogger.info("User '" + user.id + "' (" + user.email + ") logged out.")
  })
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
    return response.redirect('/')
  }
  next()
}

// create server
https.createServer(options, app).listen(PORT, ()=>{
    fo_accessLogger.info(`Successfuly started HTTPS server on port ${PORT}`);
});
