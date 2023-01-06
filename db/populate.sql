----------------------------------------
-- Table Creation
----------------------------------------
-- Named constraints are global to the database.
-- Therefore the following use the following naming rules:
--   1. pk_table for names of primary key constraints
--   2. fk_table_another for names of foreign key constraints

DROP TABLE IF EXISTS patients cascade;
DROP TABLE IF EXISTS doctors cascade;
DROP TABLE IF EXISTS appointments cascade;
DROP TABLE IF EXISTS analysis cascade;
DROP TABLE IF EXISTS labs cascade;

-- for user authentication
-- password is already encrypted pelo bcrypt
-- id from analysis encrypted with hospital public key and separated by '-'
CREATE TABLE IF NOT EXISTS patients (
    id SERIAL UNIQUE NOT NULL,
    name VARCHAR(256) NOT NULL,
    user_cc VARCHAR(256) NOT NULL,
    email text NOT NULL UNIQUE,
    password VARCHAR(256) NOT NULL,
    permissions text, 
    CONSTRAINT pk_patients PRIMARY KEY(id)
);

CREATE TABLE IF NOT EXISTS doctors (
    id SERIAL UNIQUE NOT NULL,
    name VARCHAR(256) NOT NULL,
    email text NOT NULL,
    password VARCHAR(256) NOT NULL,
    permissions text,
    CONSTRAINT pk_doctos PRIMARY KEY(id)
);

CREATE TABLE IF NOT EXISTS appointments (
    patient_id INT UNIQUE,
    doctor_id INT UNIQUE,
    date DATE NOT NULL,
    specialty VARCHAR(80),
    CONSTRAINT fk_appointments_patient FOREIGN KEY(patient_id) REFERENCES patients(id),
    CONSTRAINT fk_appointments_doctor FOREIGN KEY(doctor_id) REFERENCES doctors(id)
);

CREATE TABLE IF NOT EXISTS labs(
    name VARCHAR(256) NOT NULL UNIQUE,
    pubkey BYTEA NOT NULL
);

-- content will be encrypted using the public key of the user
-- hash_content will be encrypted using the private key of the lab
CREATE TABLE IF NOT EXISTS analysis (
    analysis_id SERIAL UNIQUE NOT NULL,
    id TEXT NOT NULL,
    lab_name TEXT NOT NULL,
    result TEXT NOT NULL,
    signature TEXT NOT NULL
);