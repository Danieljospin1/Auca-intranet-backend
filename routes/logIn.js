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
            if (typeof (Id) == 'string') {
                res.status(401).json({"message":'input valid id'})
            }
            else {
                const [student] = await connectionPromise.query(`select * from students where StudentId=${Id} AND Password='${Password}'`);



                if (!student[0]) {
                    res.status(401).json("invalid user credentials")
                }
                else {
                    const studentFaculty = await connectionPromise.query(`SELECT Faculty FROM students WHERE StudentId=${Id}`)
                    const accessToken = token.sign({ "Id": Id, "Faculty": studentFaculty[0][0].Faculty, "role": "student" }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '500s' })
                    const refreshToken = token.sign({ "Id": Id, "Faculty": studentFaculty[0][0].Faculty, "role": "student" }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '15d' })
                    res.status(200).send({ accessToken, refreshToken });
                }

            }


        }
        if (isStaff == true) {
            const [staffId] = await connectionPromise.query(`select Id from staff where Email='${Id}' AND Password='${Password}'`)

            if (!staffId[0]) {
                res.status(401).json("invalid user credentials")
            }
            else {
                const [staffDepartment] = await connectionPromise.query(`select Department from staff where Id='${staffId[0].Id}'`)
                const accessToken = token.sign({ "Id": staffId[0].Id, "Department": staffDepartment[0].Department, "role": "staff" }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '500s' })
                const refreshToken = token.sign({ "Id": staffId[0].Id, "Department": staffDepartment[0].Department, "role": "staff" }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '15d' })
                res.status(200).send({ accessToken, refreshToken });
            }
        }
        else {
            res.status(400).json({ "error": 'request error' })
        }
    }

    catch {
        (err) => {
            res.send(err)
        }
    }

})

module.exports = router;