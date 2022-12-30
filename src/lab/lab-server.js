// Lab server for demonstration purposes
const express = require('express')
const crypto = require('crypto')
const fs = require('fs')
const app = express()


const PORT = 5000
const host = '192.168.1.4'
const labName = 'Joaquim Chaves'

//const decrypted = crypto.privateDecrypt(hospitalPrivKey, encrypted)
//console.log(decrypted.toString())

//console.log(encrypted)

const test = {"result": "encryptedResult.toString('base64')" }

app.get('/test', (request, response) => {
	console.log('[LAB SERVER] Received request for /test')
	const result = prepareResult(1)
	response.status(200).send(result)
})

// create server
app.listen(PORT, host, ()=>{
    console.log(`server is runing at port ${PORT}`)
});

/**
 * Returns a patient's test result
 * Output: {
 *  Lab name: plain text,
 *  Patient ID: Ciphered and encoded in B64,
 *  Test result: Ciphered and encoded in B64,
 *  Signature: Ciphered and encoded in B64
 * }
 */
function prepareResult(patientID){
	if(patientID != 1){
		return {"result": "No results for provided patientID"}
	}

	const hospitalPubKey = fs.readFileSync("../utils/keys/public.key", "utf-8")
	//const hospitalPrivKey = fs.readFileSync("../utils/keys/private_key.pem", "utf-8")
	const labPrivKey = fs.readFileSync("../utils/keys/labs/joaquim_chaves/joaquim_chaves_private_key.pem", "utf-8")
	//const labPubKey = fs.readFileSync("../utils/keys/labs/JC/jc_public_key.pem", "utf-8")

	// fetch data from labs database ...

	const result = "HIV Test result: Positive"
	const encryptedResult = crypto.publicEncrypt({
		key: hospitalPubKey,
		padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    	oaepHash: 'sha256'
	}, result)
	const b64EncodedResult = encryptedResult.toString('base64')

	const encryptedPatientID = crypto.publicEncrypt({
		key: hospitalPubKey,
		padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    	oaepHash: 'sha256'
	}, patientID.toString())
	const b64EncodedPatientID = encryptedPatientID.toString('base64')

	//const decryptedResult = crypto.privateDecrypt({
    //  	key: hospitalPrivKey,
    //  	padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    //  	oaepHash: 'sha256'
    //}, Buffer.from(b64EncodedResult, 'base64'))

    //console.log("Decrypted: " + decryptedResult.toString())
	
	//podiamos adicionar o timestamp como salt --> acho que nao da para adicionar salt no sign
    const signature = crypto.sign("sha256", Buffer.from(b64EncodedResult, 'base64'), {
  		key: labPrivKey,
  		padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
	}).toString('base64');

	//console.log(signature);


	//const isVerified = crypto.verify("sha256", Buffer.from(b64EncodedResult, 'base64'), {
    //	key: labPubKey,
    //	padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
  	//}, Buffer.from(signature, 'base64'));

  	//console.log("signature verified: ", isVerified);
	//console.log("b64EncodedResultHash: " + b64EncodedResultHash)
	//console.log("decryptedHash: " + decryptedHash.toString())

	return {
		"Lab" : labName,
		"PatientID" : b64EncodedPatientID,
		"Result" :  b64EncodedResult,
		"LabSignature" : signature
	}

}