const client = require("../front-office/configs/database");

async function getUserByEmail(email){
  try {
    const res = await client.query('SELECT * FROM doctors WHERE email = $1', [email])
    if(res.rows.length != 0) {
      const user = {
        id: res.rows[0].id,
        name: res.rows[0].name,
        email: res.rows[0].email,
        password: res.rows[0].password 
      }
      console.log(user)
      return user;
    } else {
      return null;
    }
  } catch (err) {
    console.error(err.stack)
  }
}

async function getUserById(id){
  try {
    const res = await client.query('SELECT * FROM doctors WHERE id = $1', [id])
    if(res.rows.length != 0) {
      const user = {
        id: res.rows[0].id,
        name: res.rows[0].name,
        email: res.rows[0].email,
        password: res.rows[0].password 
      }
      return user;
    } else {
      return null;
    }
  } catch (err) {
    console.error(err.stack)
  }
}

module.exports = {
  getUserByEmail,
  getUserById
}
