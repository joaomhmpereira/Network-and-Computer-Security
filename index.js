const express = require('express')
const bodyParser = require('body-parser')
const https = require("https"), fs = require("fs"), helmet = require("helmet");
const app = express()
const db = require('./queries')
const client = require("./configs/database");
const bcrypt = require('bcrypt')
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const methodOverride = require('method-override')
const  user  =  require("./routes/users");
const { getUserAppointments } = require("./aux")
const {register} = require("./register")

app.set('view-engine', 'ejs')
app.use(express.urlencoded({ extended: false }))
app.use(flash())
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())
app.use(methodOverride('_method'))

const port = 3000
const host = '192.168.1.4'


//app.use("/user",  user);  //Route for /user endpoint of API

const options = {
  key: fs.readFileSync("keys/private_key.pem"),
  cert: fs.readFileSync("keys/cert.pem")
};

app.use(helmet());
app.use(bodyParser.json())
app.set('view engine', 'ejs')

app.get('/', (request, response) => {
  response.render("register", { })
  //response.json({ info: 'Node.js, Express, and Postgres API' })
})

app.get('/users', db.getUsers)

app.post('/register', register);

app.get('/user/appointments/:id', (request, response) => {
  const id = parseInt(request.params.id)
  var appointments = getUserAppointments(id)
    .then(appointments => { return appointments || []});
  
  //console.log(appointments)
  appointments.then(function(result){
    console.log(result);
    response.render("check_appointments", { name: 'João', data: result })
  })
  
  //response.render("check_appointments", appointments);
})

app.get('/user/:id', db.getUserById)

app.post('/users', db.createUser)

app.put('/users/:id', db.updateUser)

app.delete('/users/:id', db.deleteUser)

https.createServer(options, app).listen(4000, ()=>{
    console.log('server is runing at port 4000')
});
