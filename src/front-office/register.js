const bcrypt = require("bcrypt");
const client  =  require("./configs/database");
const { generateKeyPair } = require("crypto");
const fs = require("fs");
const { fo_accessLogger, fo_errorLogger } = require("./logger");

//Registration Function
exports.register  =  async (req, res) => {
  const { name, email, password } =  req.body;
  console.log('Name: ' + name + ' email: ' + email + ' password: ' + password)
  try {
    const  data  =  await client.query(`SELECT * FROM users WHERE email= $1;`, [email]); //Checking if user already exists
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
        .query(`INSERT INTO users (name, email, password) VALUES ($1,$2,$3);`, [user.name, user.email, user.password], (err) => {

          if (err) {
            console.error(err);
            return  res.status(500).json({
              error: "Database error"
            })
          }
          else {
            accessLogger.info(`Registered user with name: ${user.name}, email: ${user.email}`)
            generateKeyPair('rsa', {
              modulusLength: 4096,
              publicKeyEncoding: {
                type: 'spki',
                format: 'pem',
              },
              privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem',
                cipher: 'aes-256-cbc',
                passphrase: 'top secret',
              },
            }, (err, publicKey, privateKey) => {
              // Handle errors and use the generated key pair.
              var keyname = user.name.toLowerCase().replace(/\s/g, '_')
              console.log('Keyname: ' + keyname)
              fs.writeFile(`./keys/users/${keyname}_pub.pem`, publicKey, (err) => {
                if(err)
                  errorLogger.info(err)
                else
                  accessLogger.info(`Successfully generated public key for user: ${user.email}`)
              })
              fs.writeFile(`./keys/users/${keyname}_priv.pem`, privateKey, (err) => {
                if(err)
                  errorLogger.info(err)
                else
                  accessLogger.info(`Successfully generated private key for user: ${user.email}`)
              })
            });
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
