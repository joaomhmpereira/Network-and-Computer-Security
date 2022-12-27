// Lab server for demonstration purposes
const express = require('express')
const app = express()
const https = require("https")
const fs = require("fs")

const PORT = 5000
const host = '192.168.1.4'

const options = {
	key: fs.readFileSync("../utils/keys/labs/JC/jc_private_key.pem"),
	cert: fs.readFileSync("../utils/keys/labs/JC/jc_cert.pem")
}

const test = {"test": "123"}

app.get('/test', (request, response) => {
	console.log('[LAB SERVER] Received request for /test')
	response.status(200).json(test)
})

// create server
https.createServer(options, app).listen(PORT, ()=>{
    console.log(`server is runing at port ${PORT}`)
});