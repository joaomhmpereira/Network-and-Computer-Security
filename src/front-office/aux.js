const client = require("./configs/database");
const fs = require('fs')
const crypto = require('crypto')
const { fo_accessLogger, fo_errorLogger } = require("./logger");

async function getUserAppointments(id){
  try {
    const res = await client.query('SELECT * FROM appointments WHERE patient_id = $1', [id])
    return res.rows;
  } catch (err) {
    console.log(err.stack)
  }
}

async function getUserByEmail(email){
  try {
    const res = await client.query('SELECT * FROM patients WHERE email = $1', [email])
    if(res.rows.length != 0) {
      const user = {
        id: res.rows[0].id,
        cc: res.rows[0].user_cc,
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

async function getUserById(id){
  try {
    const res = await client.query('SELECT * FROM patients WHERE id = $1', [id])
    if(res.rows.length != 0) {
      const user = {
        id: res.rows[0].id,
        cc: res.rows[0].user_cc,
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

/**
 * Verify the result's signature authenticity 
 */
function processResult(result){
  //console.log(result)
  const labName = result.Lab
  const b64EncodedResult = result.Result
  const b64EncodedPatientID = result.PatientID
  const signature = result.LabSignature
  var keyname = labName.toLowerCase().replace(/\s/g, '_')

  const labKeyPath = `../utils/keys/labs/${keyname}/${keyname}_public_key.pem`
  const labPubKey = fs.readFileSync(labKeyPath, "utf-8")
  const hospitalPrivKey = fs.readFileSync("../utils/keys/private_key.pem", "utf-8")

  // Verify signature authenticity
  const isVerified = crypto.verify("sha256", Buffer.from(b64EncodedResult, 'base64'), {
    key: labPubKey,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
  }, Buffer.from(signature, 'base64'));
  console.log("Verified: " + isVerified)

  if(!isVerified){ //signature doesn't match
  
    return false
  
  } else {
    //const decryptedResult = crypto.privateDecrypt({
    //  key: hospitalPrivKey,
    //  padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    //  oaepHash: 'sha256'
    //}, Buffer.from(b64EncodedResult, 'base64')).toString()

    const decryptedPatientID = crypto.privateDecrypt({
      key: hospitalPrivKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    }, Buffer.from(b64EncodedPatientID, 'base64')).toString()

    fo_accessLogger.info(`Verified analysis result for user ${decryptedPatientID} from Lab ${labName}`)
    //console.log("Decrypted Patient ID: " + decryptedPatientID)
    //console.log("Decrypted Result: " + decryptedResult)
    return decryptedPatientID
  }
}

async function storeResult(result, patientId){
  console.log("patient id: " + patientId)
  //Inserting data into the database
  client
  .query(`INSERT INTO analysis (id, lab_name, result, signature) VALUES ($1,$2,$3,$4);`, [result.PatientID, result.Lab, result.Result, result.LabSignature], (err) => {

    if (err) {
      console.error(err);
      return false
    }
    else {
      fo_accessLogger.info(`Stored analysis result for user ${patientId} from Lab ${result.Lab}.`)
      return true
    }
  })
}

module.exports = {
  getUserAppointments,
  getUserByEmail,
  getUserById,
  processResult,
  storeResult
}
