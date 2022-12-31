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
const { response } = require('express')
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
      // stores the analysis in the dataBase
      // should return the id of the analysis
      var analysis_id = aux.storeResult(result.data, verification)
      var analysis_id_string = analysis_id.toString()
      // know we add the analysis to the permissions.
      aux.storeAnalysisPermissionsUser(analysis_id_string, verification)
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

/**
 * get for user's analysis, we should be able to see every analysis for him
 * checks if the user is authenticated to allow
 * 
 * TODO: add a buton to go to /user/analysis/permissions
 */
app.get('/user/analysis', checkAuthenticated, (request, response) => {
  // sacamos todas as análises que pertencem ao cabrao
  request.user.then(function(user){
    // sacar as análises todas usando um select ... WHERE id = (id do user cifrado)
    // colocar essas análises numa lista
    // mandar para o render.
  })
})

/**
 * here the client can give the doctor's permissions to see they're analysis
 */
app.get('/user/analysis/permissions', checkAuthenticated, (request, response) => {
  request.user.then(function(user){
    // ele insere a analise
    // insere o medico 
    // atualizamos a base de dados das permissoes 
    // para o id da analise adicionamos ao texto o id do medico.
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
