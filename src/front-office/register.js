const bcrypt = require("bcrypt");
const client  =  require("./configs/database");
const { generateKeyPair } = require("crypto");
const fs = require("fs");
const { fo_accessLogger, fo_errorLogger } = require("./logger");

//Registration Function
exports.register  =  async (req, res) => {
  const { name, cc, email, password } =  req.body;
  console.log('Name: ' + name + ' CC: ' + cc + ' email: ' + email + ' password: ' + password)
  try {
    const  data  =  await client.query(`SELECT * FROM patients WHERE email= $1;`, [email]); //Checking if user already exists
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
          cc,
          email,
          password: hash,
        };

        //Inserting data into the database
        client
        .query(`INSERT INTO patients (name, user_cc, email, password) VALUES ($1,$2,$3,$4);`, [user.name, user.cc, user.email, user.password], (err) => {

          if (err) {
            console.error(err);
            return  res.status(500).json({
              error: "Database error"
            })
          }
          else {
            fo_accessLogger.info(`Registered user with name: ${user.name}, email: ${user.email}.`)
            res.redirect('/');
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
