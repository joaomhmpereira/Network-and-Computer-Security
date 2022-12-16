const express = require('express')
const bodyParser = require('body-parser')
const https = require("https"), fs = require("fs"), helmet = require("helmet");
const app = express()
const db = require('./queries')
const { Pool, Client } = require('pg')
const dotenv = require("dotenv");
dotenv.config()

// psql Database credentials
const credentials = {
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
};

const client = new Pool(credentials);

const port = 3000
const host = '192.168.1.4'

const options = {
  key: fs.readFileSync("keys/private_key.pem"),
  cert: fs.readFileSync("keys/cert.pem")
};

app.use(helmet());
app.use(bodyParser.json())
app.set('view engine', 'ejs')
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
)

app.get('/', (request, response) => {
  response.render("home", { })
  //response.json({ info: 'Node.js, Express, and Postgres API' })
})

app.get('/users', db.getUsers)

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

async function getUserAppointments(id){
  //const id = parseInt(request.params.id)
  try {
    const res = await client.query('SELECT * FROM appointments WHERE id = $1', [id])
    // { name: 'brianc', email: 'brian.m.carlson@gmail.com' }
    return res.rows;
  } catch (err) {
    console.log(err.stack)
  }
}