const express = require('express')
const bodyParser = require('body-parser')
const https = require("https"), fs = require("fs"), helmet = require("helmet");
const app = express()
const db = require('./queries')
const client = require("./configs/database");
const bcrypt = require('bcrypt')
const cookieParser = require("cookie-parser");
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const methodOverride = require('method-override')

const aux = require("./aux")
const { register } = require("./register")
const { login } = require("./login")

const initializePassport = require('./passport-config')
initializePassport(
  passport,
  aux.getUserByEmail,
  aux.getUserById
)

app.set('view-engine', 'ejs')
app.use(express.urlencoded({ extended: false }))
app.use(flash())
app.use(cookieParser())
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
app.use(methodOverride('_method'))

const port = 3000
const host = '192.168.1.4'

const options = {
  key: fs.readFileSync("keys/private_key.pem"),
  cert: fs.readFileSync("keys/cert.pem")
};

app.use(helmet());
app.use(bodyParser.json())
app.set('view engine', 'ejs')

app.get('/', checkAuthenticated, (request, response) => {
  request.user.then(function(user){
    console.log('user: ')
    console.log(user)
    console.log('name: ' + user.name)
    response.render('home', { name: user.name })
  })
})

app.get('/register', checkNotAuthenticated, (request, response) => {
  response.render("register", { })
})

app.post('/register', checkNotAuthenticated, register);

app.get('/login', checkNotAuthenticated, (request, response) => {
  response.render("login")
})

app.post('/login', checkNotAuthenticated, passport.authenticate('local', {
  successRedirect: '/user/appointments',
  failureRedirect: '/login',
  failureFlash: true
}));

app.get('/user/appointments/', checkAuthenticated, (request, response) => {
  request.user.then(function(user){
    const id = user.id
    var appointments = aux.getUserAppointments(id)
                       .then(appointments => { return appointments || []});
  
    appointments.then(function(result){
      console.log(result);
      response.render("check_appointments", { name: user.name, data: result })
    })  
  })
  
})

function checkAuthenticated(request, response, next) {
  if(request.isAuthenticated()) {
    console.log('user is authenticated')
    return next()
  }
  console.log('user is not authenticated')
  response.redirect('/login')
}

function checkNotAuthenticated(request, response, next) {
  if (request.isAuthenticated()) {
    console.log('user is authenticated')
    return response.redirect('/')
  }
  console.log('user is not authenticated')
  next()
}

https.createServer(options, app).listen(4000, ()=>{
    console.log('server is runing at port 4000')
});
