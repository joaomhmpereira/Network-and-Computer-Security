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

//GET all users
const getUsers = (request, response) => {
	client.query('SELECT * FROM sah_users ORDER BY id ASC', (error, results) => {
    if (error) {
      throw error
    }

    response.status(200).json(results.rows)
  })
}

//GET a single users given a user_id
const getUserById = (request, response) => {
	const id = parseInt(request.params.id)

	client.query('SELECT * FROM sah_users WHERE id = $1', [id], (error, results) => {

		if (error) {
			throw error
		}
		response.status(200).json(results.rows)
	})
}

//POST a new user
const createUser = (request, response) => {
	const { name, age } = request.body

	client.query('INSERT INTO sah_users (name, age) VALUES ($1, $2) RETURNING *', [name, age], (error, results) => {

		if (error) {
			throw error
		}

		// 201 -> Created with success
		response.status(201).send(`User ${results.rows[0].name} added with ID: ${results.rows[0].id}`)
	})
}

//UPDATE an user's info
const updateUser = (request, response) => {
	const id = parseInt(request.params.id)
  	const { name, age } = request.body

  	client.query('UPDATE users SET name = $1, age = $2 WHERE id = $3', [name, age, id], (error, results) => {
  	    
  	    if (error) {
  	      throw error
  	    }
  	    
  	    response.status(200).send(`User modified with ID: ${id}.`)
  	})
}


//DELETE an user
const deleteUser = (request, response) => {
	const id = parseInt(request.params.id)

	client.query('DELETE FROM sah_users WHERE id = $1', [id], (error, results) => {

		if (error){
			throw error
		}

		response.status(200).send(`User deleted with ID: ${id}`)
	})
}

module.exports = {
	getUsers,
	getUserById,
	createUser,
	updateUser,
	deleteUser
}