const client = require("../front-office/configs/database")
const fs = require('fs')
const crypto = require('crypto')


/**
 * Decrypts a text with the hospital private key.
 * 
 * @param {*} encoded_text, it is encoded with the hospital public key
 * @returns decryptedText
 */
async function decryptWithHospitalPublicKey(encoded_text){
  const hospitalPrivKey = fs.readFileSync("../utils/keys/private_key.pem", "utf-8")
  const decryptedText = crypto.privateDecrypt({
    key: hospitalPrivKey,
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256'
  }, Buffer.from(encoded_text, 'base64')).toString()
  return decryptedText
}

/**
 * returns a list with the analysis id's the user has permissions to 
 * 
 * @param {*} permissions 
 */
async function permissionsToList(permissions){
  var arr = permissions.split("-")
  console.log(arr)
  return arr
}


/**
 * gets a list of analysis from the user id 
 * 
 * @param {*} user_id 
 * @returns list of analysis 
 */
async function showListAnalysisFromDoctor(user_id){
  try{
    var permsUser = await getDoctorPermissions(user_id)
    if( permsUser == "") return [] // if no permissions
    var permsList = await permissionsToList(permsUser)
    console.log("list of permissions: ")
    console.log(permsList) 
    for(var i=0, listAnalysis = [], permsLength = permsList.length; i<permsLength; i = i+1){
      if(permsList[i] == ''){continue }
      var analysisDecrypted = await getAnalysisDecrypted(permsList[i])
      listAnalysis.push(analysisDecrypted)
    }
    return listAnalysis
  }catch(error){
    console.error(error)
    console.log("SHOW LIST ANALYSIS")
  }
}


/**
 * Returns a string with the permissions of the user
 * 
 * @param {*} user_id 
 * @returns permissions for that user
 */
async function getDoctorPermissions(user_id){
  var permsUser = await client.query('SELECT permissions FROM doctors WHERE id = $1;', [user_id])
  console.log(permsUser.rows[0].permissions)
  var permsEncrypted = permsUser.rows[0].permissions
  if(permsEncrypted == null){
    console.log("no permissions for you :(")
    return ""
  } 
  else{ // not null must decrypt
    var permsDecrypt = await decryptWithHospitalPublicKey(permsEncrypted)
    return permsDecrypt
  }
}

/**
 * Returns the given analysis decrypted
 * 
 * @param {*} analysis_id 
 */
async function getAnalysisDecrypted(analysis_id){
  try{
    const res = await client.query("SELECT * FROM analysis WHERE analysis_id = $1;", [analysis_id])
    if(res.rows.length != 0){
      var idDecrypted = await decryptWithHospitalPublicKey(res.rows[0].id)
      var resultDecrypted = await decryptWithHospitalPublicKey(res.rows[0].result)
      const analysis = {
        analysis_id: res.rows[0].analysis_id,
        id: idDecrypted,
        lab_name: res.rows[0].lab_name,
        result: resultDecrypted
      }
      return analysis
    }
  } catch(error){
    console.error(error)
    console.log("problem loading the analysis from database")
  }
}



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
  decryptWithHospitalPublicKey,
  getUserByEmail,
  getUserById,
  getAnalysisDecrypted,
  getDoctorPermissions,
  permissionsToList,
  showListAnalysisFromDoctor,
}
