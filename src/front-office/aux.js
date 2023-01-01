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
async function checkIfHasAccessToAnalysis(analysis_id, user_id){
  var permsUserEncrypted = await getUserPermissions(user_id)
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
async function getUserPermissions(user_id){
  var permsUser = await client.query('SELECT permissions FROM patients WHERE id = $1;', [user_id])
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
 * CAREFUL: it does not check if analysis is already there
 * 
 * @param {*} analysis_id 
 * @param {*} user_id 
 */
async function addAnalysisToPermissions(analysis_id, user_id, table){
  try{
    var permsUser = await getUserPermissions(user_id)
    if(permsUser == ""){ var newPermsUser = analysis_id+"-" }
    else{ var newPermsUser = permsUser+analysis_id+"-" }

    console.log("decrypted perms: " + permsUser)
    console.log("unencrypted perms: " + newPermsUser)
    console.log("length of new perms: " + newPermsUser.length )

    var newPermsUserEncrypted = await encryptWithHospitalPublicKey(newPermsUser)
    queryString = "UPDATE "+table+" SET permissions = '"+newPermsUserEncrypted+"' WHERE id = "+user_id+";"
    console.log("query: " + queryString)
    await client.query(queryString)
  } catch(error){
    console.error(error)
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
    var result = await axios.get('http://192.168.1.4:5000/test')
    var verification = processResult(result.data)
    if(verification != false){
      var response = await storeResult(result.data, verification)
      console.log(response)
      var analysis_id_string = response.toString()
      var store = await storeAnalysisPermissionsUser(analysis_id_string, verification, 'patients')
      return true

    }
  }
  catch(error){
    console.error(error)
  }
  
  //var res = axios.get('http://192.168.1.4:5000/test')
  //      .then(res => { return res || [] })
  //      .catch(error => { return error });
  //res.then(function(result){
  //  //console.log(result.data)
  //  const verification = processResult(result.data) 
  //  if(verification != false){
  //    // stores the analysis 
  //    storeResult(result.data, verification)
  //      .then(response => { 
  //        console.log(response)
  //        var analysis_id_string = response.toString()
  //        // stores permissions
  //        storeAnalysisPermissionsUser(analysis_id_string, verification, 'patients')
  //      })
  //      .catch(error => {
  //        console.error(error)
  //      }) 
  //  } else {
  //    console.log("verification failed")
  //  }
  //  return true
  //})
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
    var queryResponse = await client.query(`INSERT INTO analysis (id, lab_name, result, signature) VALUES ($1,$2,$3,$4) RETURNING analysis_id;`, 
                                [result.PatientID, result.Lab, result.Result, result.LabSignature])
    var analysis_id = queryResponse.rows[0].analysis_id
    console.log("analysis id:")
    console.log(analysis_id)
    return analysis_id 
  }catch(err){
    console.error(err.stack)
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
  console.log("storing permissions in user: "+ user_id)
  try{
    console.log(analysis_id)
    var hasAlreadyAccess = await checkIfHasAccessToAnalysis(analysis_id, user_id)
    if( hasAlreadyAccess == true) {
      console.log("already had access")
      return true 
    }
    var res = await addAnalysisToPermissions(analysis_id, user_id, table)
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
async function showListAnalysisFromUser(user_id){
  try{
    var permsUser = await getUserPermissions(user_id)
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
    console.error(err.stack)
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
    console.error(error)
    console.log("no analysis with that ID")
  }
}



// ====================================================================
// user getters
// ====================================================================

async function getUserAppointments(id){
  try {
    const res = await client.query('SELECT * FROM appointments WHERE patient_id = $1;', [id])
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
    console.error(err.stack)
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
  storeAnalysisPermissionsUser,
  storeAnalysisPermissionsDoctor,
  checkIfAnalysisExists,
  getAnalysisDecrypted,
  permissionsToList,
  showListAnalysisFromUser
}
