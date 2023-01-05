const LocalStrategy = require('passport-local').Strategy
const bcrypt = require('bcrypt')
const { fo_accessLogger, fo_errorLogger } = require("./logger")

function initialize(passport, getUserByEmail, getUserById) {
  const authenticateUser = async (email, password, done) => {
    const user = getUserByEmail(email)
                 .then(user => { return user || null });
    
    user.then(function(user){
      if (user == null) {
        console.log("User does not exist")
        return done(null, false, { message: 'Wrong credentials. Please try again.' })
      }
      try {
        if (bcrypt.compareSync(password, user.password)) {
          fo_accessLogger.info("User '" + user.id + "' (" + user.email + ") logged in.")
          return done(null, user)
        } else {
          return done(null, false, { message: 'Wrong credentials. Please try again.' })
        }
      } catch (e) {
        return done(e)
      }      
    })
    
  }

  passport.use(new LocalStrategy({ usernameField: 'email' }, authenticateUser))
  passport.serializeUser((user, done) => done(null, user.id))
  passport.deserializeUser((id, done) => {
    return done(null, getUserById(id))
  })
}

module.exports = initialize