const client = require("./configs/database");
const fs = require('fs')
const crypto = require('crypto')
const axios = require('axios')
const { fo_accessLogger, fo_errorLogger } = require("./logger");



// ====================================================================
// for permissions and encryption
// ====================================================================

/**
 * encrypts a text with a given key
 * right now it is encrypting with base 64.
 * 
 * @param {*} text 
 */
async function encryptWithHospitalPublicKey(text){
  const hospitalPubKey = fs.readFileSync("../utils/keys/public.key", "utf-8")
  const encryptedText = crypto.publicEncrypt({
		key: hospitalPubKey,
		padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256'
	}, text)
  console.log(encryptedText)
	const b64EncodedText = encryptedText.toString('base64')
  return b64EncodedText
}


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


// ====================================================================
// for analysis and permissions
// ====================================================================

/**
 * know the permissions for a specific analysis
 * TODO: the analysis id should be encrypted.
 * 
 * @param  analysis_id 
 */
async function getAnalysisPermissions(analysis_id){
  try{
    let analysis_id_encripted = encryptWithHospitalPublicKey(analysis_id)
    console.log(analysis_id_encripted)
    const res = await client.query('SELECT * FROM permissions WHERE id = $1', [analysis_id_encripted])
    return res.rows;
  } catch(err){
    console.log(err.stack)
  }
}


/**
 * verifies the signature and returns the patients id decrypted
 * 
 * @param {*} result 
 * @returns the patients id decrypted
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


/**
 * stores the encrypted payload of the analysis in it's according table
 * TODO: This should return the analysis ID.
 * TODO: FIX THE RETURN BUG
 * 
 * @param {*} result 
 * @param {*} patientId 
 * @returns analysisId
 */
async function storeResult(result, patientId){
  try{
    console.log("patient id: " + patientId)
    //Inserting data into the database
    client.query(`INSERT INTO analysis (id, lab_name, result, signature) VALUES ($1,$2,$3,$4);`, 
                                [result.PatientID, result.Lab, result.Result, result.LabSignature], (err) => {
      if (err) {
        console.error(err);
      }
      else {
        fo_accessLogger.info(`Stored analysis result for user ${patientId} from Lab ${result.Lab}.`)

      }
    })
    return 1 // fixed the bug for now
  }catch(err){
    console.error(err.stack)
  }
}


/**
 * TODO: This should be encrypted with the public key of the hospital 
 * TODO: check if it holds up with more analysis
 * 
 * @param {*} analysis_id 
 * @param {*} user_id 
 */
async function storeAnalysisPermissionsUser(analysis_id, user_id, table){
  console.log("storing permissions in user: "+ user_id)
  try{
    console.log(analysis_id)
    let permsUser = await client.query('SELECT permissions FROM patients WHERE id = $1;', [user_id])
    console.log(permsUser.rows)

    if(permsUser.rows.length != 0){ 
      var decryptedPermsUser = await decryptWithHospitalPublicKey(permsUser.rows.permissions) 
    }
    else { var decryptedPermsUser = "" }
    
    let newPermsUser = decryptedPermsUser + "-" + analysis_id
    let newPermsUserEncrypted = await encryptWithHospitalPublicKey(newPermsUser)

    client.query('UPDATE $1 SET permissions = $2 WHERE id = $3;', [table, newPermsUserEncrypted, user_id])
  } catch (error) {
    console.error(error)
  }
}


/**
 * Gives permission to a doctor to see an analysis
 * 
 * @param {*} analysis_id 
 * @param {*} doctor_id 
 */
async function storeAnalysisPermissionsDoctor(analysis_id, doctor_id){
  if(checkIfDoctorExists(doctor_id)){
    storeAnalysisPermissionsUser(analysis_id, doctor_id, 'doctors')
    return true
  } else{
    return false
  }
}



// ====================================================================
// doctors
// ====================================================================

/**
 * simply checks if there is a doctor with such id
 * 
 * @param {*} doctor_id 
 * @returns TRUE/FALSE
 */
async function checkIfDoctorExists(doctor_id){
  try{
    const res = await client.query('SELECT * FROM doctors WHERE id = $1', [doctor_id])
    if (res.rows.length() > 0){
      return true
    } else {
      return false
    }
  } catch(err){
    console.error(err.stack)
  }
}



// ====================================================================
// user getters
// ====================================================================

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





module.exports = {
  encryptWithHospitalPublicKey,
  decryptWithHospitalPublicKey,
  getUserAppointments,
  getUserByEmail,
  getAnalysisPermissions,
  getUserById,
  processResult,
  storeResult,
  storeAnalysisPermissionsUser,
  storeAnalysisPermissionsDoctor
}
