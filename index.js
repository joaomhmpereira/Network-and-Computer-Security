const express = require('express')
const bodyParser = require('body-parser')
const https = require("https"), fs = require("fs"), helmet = require("helmet");
const app = express()
const client = require("./configs/database");
const bcrypt = require('bcrypt')
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const aux = require("./aux")
const { register } = require("./register")
const { accessLogger, errorLogger } = require("./logger");

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

const PORT = 4000
const host = '192.168.1.4'

// read private key and certificate for https
const options = {
  key: fs.readFileSync("keys/private_key.pem"),
  cert: fs.readFileSync("keys/cert.pem")
};

// set EJS as view engine
app.set('view engine', 'ejs')
app.use(helmet());
app.use(bodyParser.json())

// load homepage
app.get('/', checkAuthenticated, (request, response) => {
  request.user.then(function(user){
    response.render('home', { name: user.name })
  })
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
app.get('/user/appointments/', checkAuthenticated, (request, response) => {
  request.user.then(function(user){
    const id = user.id
    accessLogger.info("User '" + id + "' (" + user.email + ") accessed /user/appointments")
    var appointments = aux.getUserAppointments(id)
                       .then(appointments => { return appointments || []});
  
    appointments.then(function(result){
      response.render("check_appointments", { name: user.name, data: result })
    })  
  })
})

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
    return response.redirect('/')
  }
  next()
}

// create server
https.createServer(options, app).listen(PORT, ()=>{
    accessLogger.info(`Successfuly started HTTPS server on port ${PORT}`);
    console.log(`server is runing at port ${PORT}`)
});
