const bcrypt = require("bcrypt");
const client  =  require("../front-office/configs/database");
const fs = require("fs");
const { bo_accessLogger, bo_errorLogger } = require("../front-office/logger")

//Registration Function
exports.register  =  async (req, res) => {
  const { name, email, password } =  req.body;
  console.log('Name: ' + name + ' email: ' + email + ' password: ' + password)
  try {
    const  data  =  await client.query(`SELECT * FROM doctors WHERE email= $1;`, [email]); //Checking if user already exists
    const  arr  =  data.rows;
    if (arr.length  !=  0) {
      return  res.status(400).json({
        error: "Email already there, No need to register again.",
      });
    }
    else {
      bcrypt.hash(password, 10, (err, hash) => {
        if (err)
          res.status(err).json({
            error: "Server error",
          });
        const  user  = {
          name,
          email,
          password: hash,
        };

        //Inserting data into the database
        client
        .query(`INSERT INTO doctors (name, email, password) VALUES ($1,$2,$3);`, [user.name, user.email, user.password], (err) => {

          if (err) {
            console.error(err);
            return  res.status(500).json({
              error: "Database error"
            })
          }
          else {
            bo_accessLogger.info(`Registered user with name: ${user.name}, email: ${user.email}.`)
            res.redirect('/doctor/profile');
          }
        })
      });
    }
  }
  catch (err) {
    console.log(err);
    res.status(500).json({
      error: "Database error while registring user!", //Database connection error
    });
  };
}
