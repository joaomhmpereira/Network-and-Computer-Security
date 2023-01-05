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


/**
 * checks if a user already has access to a analysis
 * 
 * @param {*} analysis_id 
 * @param {*} user_id 
 * @returns true/false
 */
async function checkIfHasAccessToAnalysis(analysis_id, user_id, table){
  var permsUserEncrypted = await getUserPermissions(user_id, table)
  if(permsUserEncrypted.includes(analysis_id)){
    return true
  }else{ 
    return false 
  }
}

/**
 * Returns a string with the permissions of the user
 * 
 * @param {*} user_id 
 * @returns permissions for that user
 */
async function getUserPermissions(user_id, table){
  var queryString = "SELECT permissions FROM "+table+" WHERE id = "+user_id+";"
  var permsUser = await client.query(queryString)
  var permsEncrypted = permsUser.rows[0].permissions
  if(permsEncrypted == null){
    return ""
  } 
  else{ // not null must decrypt
    var permsDecrypt = await decryptWithHospitalPublicKey(permsEncrypted)
    return permsDecrypt
  }
}


/**
 * CAREFUL: it does not check if analysis is already there
 * nor does it check if the user exists
 * 
 * @param {*} analysis_id 
 * @param {*} user_id 
 */
async function addAnalysisToPermissions(analysis_id, user_id, table){
  try{
    var permsUser = await getUserPermissions(user_id, table)
    if(permsUser == ""){ var newPermsUser = analysis_id+"-" }
    else{ var newPermsUser = permsUser+analysis_id+"-" }

    var newPermsUserEncrypted = await encryptWithHospitalPublicKey(newPermsUser)
    queryString = "UPDATE "+table+" SET permissions = '"+newPermsUserEncrypted+"' WHERE id = "+user_id+";"
    await client.query(queryString)
    fo_accessLogger.info("User " + user_id + " updated the permissions of analysis " + analysis_id + ".")
  } catch(error){
    fo_errorLogger.info(error)
  }
}


// ====================================================================
// for analysis and permissions
// ====================================================================


/**
 * Ask an update to the lab, it will respond with analysis from patient 1
 */
async function askUpdateFromLab(){
  try{
    var result = await axios.get('http://192.168.2.4:5000/test')
    var verification = processResult(result.data) // true if it all works out
    if(verification != false){
      var response = await storeResult(result.data, verification)

      var analysis_id_string = response.toString()
      var store = await storeAnalysisPermissionsUser(analysis_id_string, verification, 'patients')
      
      fo_accessLogger.info("Granted patient " + verification + " access to the analysis result.")
      return true
    }
  }
  catch(error){
    fo_errorLogger.info(error)
  }
}


/**
 * verifies the signature and returns the patients id decrypted
 * 
 * @param {*} result 
 * @returns the patients id decrypted
 */
function processResult(result){
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

  if(!isVerified){ //signature doesn't match
  
    return false
  
  } else {
    const decryptedPatientID = crypto.privateDecrypt({
      key: hospitalPrivKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    }, Buffer.from(b64EncodedPatientID, 'base64')).toString()

    fo_accessLogger.info(`Verified analysis result for user ${decryptedPatientID} from Lab ${labName}`)
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
    //Inserting data into the database
    var queryResponse = await client.query(`INSERT INTO analysis (id, lab_name, result, signature) VALUES ($1,$2,$3,$4) RETURNING analysis_id;`, 
                                [result.PatientID, result.Lab, result.Result, result.LabSignature])
    var analysis_id = queryResponse.rows[0].analysis_id
    fo_accessLogger.info("Stored analysis result for patient " + patientId + ".")
    return analysis_id 
  }catch(err){
    fo_errorLogger.info(err)
  }
}


/** 
 * TODO: check if it holds up with more analysis
 * TODO: check if the analysis exists
 * TODO: check if he already has access to that analysis
 * 
 * @param {*} analysis_id 
 * @param {*} user_id 
 */
async function storeAnalysisPermissionsUser(analysis_id, user_id, table){
  try{
    var hasAlreadyAccess = await checkIfHasAccessToAnalysis(analysis_id, user_id, table)
    if( hasAlreadyAccess == true) {
      // user already has access
      return true 
    }
    var res = await addAnalysisToPermissions(analysis_id, user_id, table)
  } catch (error) {
    fo_errorLogger.info(error)
  }
}


/**
 * Gives permission to a doctor to see an analysis
 * 
 * @param {*} analysis_id 
 * @param {*} doctor_id 
 */
async function storeAnalysisPermissionsDoctor(analysis_id, doctor_id){
  if(await checkIfDoctorExists(doctor_id)){
    storeAnalysisPermissionsUser(analysis_id, doctor_id, 'doctors')
    return true
  } else{
    return false
  }
}


/**
 * returns a list with the analysis id's the user has permissions to 
 * 
 * @param {*} permissions 
 */
async function permissionsToList(permissions){
  var arr = permissions.split("-")
  return arr
}


/**
 * gets a list of analysis from the user id 
 * 
 * @param {*} user_id 
 * @returns list of analysis 
 */
async function showListAnalysisFromUser(user_id){
  try{
    var permsUser = await getUserPermissions(user_id, 'patients')
    if( permsUser == "") return [] // if no permissions
    var permsList = await permissionsToList(permsUser)

    for(var i=0, listAnalysis = [], permsLength = permsList.length; i<permsLength; i = i+1){
      if(permsList[i] == ''){continue }
      var analysisDecrypted = await getAnalysisDecrypted(permsList[i])

      listAnalysis.push(analysisDecrypted)
    }

    return listAnalysis
  } catch(error){
    fo_errorLogger.info(error)
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
    const res = await client.query('SELECT * FROM doctors WHERE id = $1;', [doctor_id])
    if (res.rows.length > 0){
      return true
    } else {
      return false
    }
  } catch(err){
    fo_errorLogger.info(err)
  }
}


/**
 * checks if that given analysis exists in the database
 * 
 * @param {*} analysis_id 
 * @returns 
 */
async function checkIfAnalysisExists(analysis_id){
  try{
    const res = await client.query('SELECT * FROM analysis WHERE analysis_id = $1;', [analysis_id])
    if(res.rows.length > 0){
      return true
    } else {
      return false
    }
  }catch(error){
    fo_errorLogger.info(err)
  }
}


/**
 * Adds permission to see analysis to a given doctor
 * 
 * @param {*} analysis_id 
 * @param {*} user_id 
 */
async function addPermissionsToDoctors(user, analysis_id, doctor_id){
  if(await checkIfAnalysisExists(analysis_id) == false) {
    fo_accessLogger.info("User " + user.id + " (" + user.email + ") tried to add permissions to an analysis (id: " + analysis_id + ") that doesn't exist.")
    return false
  }
  if(await checkIfDoctorExists(doctor_id) == false) {
    fo_accessLogger.info("User " + user.id + " (" + user.email + ") tried to add permissions to a doctor (id: " + doctor_id + ") that doesn't exist.")
    return false
  }
  await addAnalysisToPermissions(analysis_id, doctor_id, 'doctors')
}



// ====================================================================
// user getters
// ====================================================================

async function getUserAppointments(id){
  try {
    const res = await client.query('SELECT * FROM appointments WHERE patient_id = $1;', [id])
    return res.rows;
  } catch (err) {
    fo_errorLogger.info(err)
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
    fo_errorLogger.info(err)
  }
}

async function getUserById(id){
  try {
    const res = await client.query('SELECT * FROM patients WHERE id = $1;', [id])
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
    fo_errorLogger.info(err)
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
    fo_errorLogger.info(error)
  }
}


module.exports = {
  encryptWithHospitalPublicKey,
  decryptWithHospitalPublicKey,
  checkIfHasAccessToAnalysis,
  addAnalysisToPermissions,
  getUserPermissions,
  getUserAppointments,
  askUpdateFromLab,
  getUserByEmail,
  getUserById,
  processResult,
  storeResult,
  addPermissionsToDoctors,
  storeAnalysisPermissionsUser,
  storeAnalysisPermissionsDoctor,
  checkIfAnalysisExists,
  getAnalysisDecrypted,
  permissionsToList,
  showListAnalysisFromUser
}
