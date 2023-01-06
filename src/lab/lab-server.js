// Lab server for demonstration purposes
const express = require('express')
const crypto = require('crypto')
const fs = require('fs')
const app = express()


const PORT = 5000
const host = '192.168.2.4'
const labName = 'Joaquim Chaves'

app.get('/test', (request, response) => {
	console.log('[LAB SERVER] Received request for /test')
	const result = prepareResult(1) // just for user 1
	response.status(200).send(result)
})

app.get('/evil', (request, response) => {
	console.log('[LAB SERVER] Received request for /evil')
	const result = prepareEvilResult(1) // just for user 1
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
	const hospitalPubKey = fs.readFileSync("../utils/keys/public.key", "utf-8")
	const labPrivKey = fs.readFileSync("../utils/keys/labs/joaquim_chaves/joaquim_chaves_private_key.pem", "utf-8")
	// fetch data from labs database ...

	const result = "Myopia level: -2.0D"
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
	
    const signature = crypto.sign("sha256", Buffer.from(b64EncodedResult, 'base64'), {
  		key: labPrivKey,
  		padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
	}).toString('base64');

	return {
		"Lab" : labName,
		"PatientID" : b64EncodedPatientID,
		"Result" :  b64EncodedResult,
		"LabSignature" : signature
	}
}

/**
 * For demonstration
 */
function prepareEvilResult(patientID){

	const hospitalPubKey = fs.readFileSync("../utils/keys/public.key", "utf-8")
	const labPrivKey = fs.readFileSync("../utils/keys/labs/joaquim_chaves/joaquim_chaves_private_key.pem", "utf-8")

	// fetch data from labs database ...

	const result = "IQ test: 161"
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

    const signature = crypto.sign("sha256", Buffer.from(b64EncodedResult, 'base64'), {
  		key: labPrivKey,
  		padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
	}).toString('base64');


    // change the analysis' result, now signature won't match
	const evil_result = "Evil result"
	const evilEncryptedResult = crypto.publicEncrypt({
		key: hospitalPubKey,
		padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    	oaepHash: 'sha256'
	}, evil_result)
	const b64EvilEncodedResult = evilEncryptedResult.toString('base64')

	return {
		"Lab" : labName,
		"PatientID" : b64EncodedPatientID,
		"Result" :  b64EvilEncodedResult,
		"LabSignature" : signature
	}
}