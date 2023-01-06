# SIRS - SAH Healthcare

- Instructions to run the project:
	- all development was done in the SEED Labs VM so the required platform is: Linux 64-bit, Ubuntu
	- run command `npm i` on the directories 'front-office', 'back-office' and 'lab' to install all the node modules used
	- and `.env` files to directories 'front-office' and 'back-office' with the following structure:
		- PGUSER="..."
		- PGHOST="..."
		- PGPASSWORD="..."
		- PGDATABASE="..."
		- PGPORT=...
		- SESSION_SECRET="..."
	- in each field of type `PG...` add the corresponding information corresponding to the database PostgreSQL server
	- in the `SESSION_SECRET` field add a random string. This will be used as a salt to each session id
	- to start up the frontend run `npm run start` in the `front-office` directory. This will start all 3 servers (front-office, back-office, lab), ports 8080, 8081, and 5000 respectivelly.

**The IP addresses for each VM have to be set up as shown in the report**
A PostgreSQL has to be created in VM2 (the one with IP 192.168.1.1) and the appropriate files have to be configured in order to accept connections from VM3 (the one with IP 192.168.2.4). This may imply changing configuration files like `/etc/postgresql/12/main/phba.conf`
