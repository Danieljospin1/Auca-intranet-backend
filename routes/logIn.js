require('dotenv').config();
const express = require('express');
const router = express.Router();
const token = require('jsonwebtoken');
const connectionPromise = require('../database & models/databaseConnection');




router.post('/', async (req, res) => {
    const { Id, Password, isStaff } = req.body;
    if (!Id || !Password) {
        res.json("message:Please input Your Id/Email And Password")
    }

    try {
        if (isStaff == false) {
            const [student] = await connectionPromise.query(`select * from students where StudentId=${Id} AND Password='${Password}'`);
            


            if (!student[0]) {
                res.status(401).json("invalid user credentials")
            }
            else {
                const studentFaculty=await connectionPromise.query(`select Faculty from students where StudentId=${Id}`)
                connectionPromise.query(studentFaculty,(error,results)=>{
                    if (error) throw error
                    const faculty = results[0]?.Faculty
                    const accessToken = token.sign({ "studentId": Id,"faculty":studentFaculty[0] }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '225s' })
                    const refreshToken = token.sign({ "studentId": Id,"faculty":studentFaculty }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '15d' })
                    res.status(200).send({ faculty});
                })
                
            }
        }
        else {
            const [staff] = await connectionPromise.query(`select * from staff where Email='${Id}' AND Password='${Password}'`);


            if (!staff[0]) {
                res.status(401).json("invalid user credentials")
            }
            else {
                const staffDepartment=await connectionPromise.query(`select Department from staff where Email='${Id}'`)
                const accessToken = token.sign({ "staffId": Id, "Department":staffDepartment }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '500s' })
                const refreshToken = token.sign({ "staffId": Id, "Department":staffDepartment }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '15d' })
                res.status(200).send({ accessToken, refreshToken });
            }
        }
    }

    catch {
        (err) => {
            res.send(err)
        }
    }

})

module.exports = router;