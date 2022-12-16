const  client  =  require("./configs/database");

async function getUserAppointments(id){
  try {
    const res = await client.query('SELECT * FROM appointments WHERE patient_id = $1', [id])
    return res.rows;
  } catch (err) {
    console.log(err.stack)
  }
}

module.exports = {
  getUserAppointments
}
