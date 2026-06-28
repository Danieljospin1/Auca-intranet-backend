require('dotenv').config();
const express = require('express');
const router = express.Router();
const token = require('jsonwebtoken');
const connectionPromise = require('../database & models/databaseConnection');




router.post('/', async (req, res) => {
    const { Id, Password, UserType } = req.body;
    console.log("user received.......",req.body)
    if (!Id || !Password ) {
        return res.json("message:Please input Your Id/Email And Password")
    }
    if(!UserType){
        return res.status(400).json("message: Unable to get user type.")
    }
    


    try {
        if (UserType.toLowerCase()==="student" ) {
            console.log(UserType);
            console.log(UserType.toLowerCase())
            if (typeof (Id) == 'string') {
                return res.status(401).json({"message":'input valid id'})
            }
            else {
                const [student] = await connectionPromise.query(`select * from students where StudentId=? AND Password=?`,[Id,Password]);

                if (!student[0]) {
                    return res.status(401).json("invalid user credentials")
                }
                else {
                    const [studentProfile]= await connectionPromise.query(`select StudentId,Fname,Lname,Email,Phone,Faculty,Department,ProfileUrl,StudyLevel from students where StudentId=?`,[Id]);
                    const studentFaculty = await connectionPromise.query(`SELECT Faculty FROM students WHERE StudentId=?`,[Id])
                    const accessToken = token.sign({ "Id": Id,"StudyLevel": studentProfile[0].StudyLevel, "Faculty": studentFaculty[0][0].Faculty,"Department": studentProfile[0].Department, "role": "student" }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '2h' })
                    const refreshToken = token.sign({ "Id": Id,"StudyLevel": studentProfile[0].StudyLevel, "Faculty": studentFaculty[0][0].Faculty,"Department":studentProfile[0].Department, "role": "student" }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '15d' })
                    return res.status(200).send({ accessToken, refreshToken,studentProfile });
                }
            }
        }
        if(UserType.toLowerCase()==="aucasa"){
            if (typeof (Id) == 'string') {
                return res.status(401).json({"message":'input valid Id.'})
            }
            else {
                const [student] = await connectionPromise.query(`select * from students where StudentId=? AND Password=?`,[Id,Password]);

                if (!student[0]) {
                    return res.status(401).json("invalid user credentials")
                }
                else {
                    const [aucasaUserRole]=await connectionPromise.query(`select role from aucasa where StudentId=? AND IsInService=1`,[Id]);
                    
                    if(!aucasaUserRole[0]){
                        return res.status(401).json("invalid user credentials.");
                    }
                    const [studentProfile]= await connectionPromise.query(`select StudentId,Fname,Lname,Email,Phone,Faculty,Department,ProfileUrl,StudyLevel from students where StudentId=?`,[Id]);
                    const studentFaculty = await connectionPromise.query(`SELECT Faculty FROM students WHERE StudentId=?`,[Id])
                    const accessToken = token.sign({ "Id": Id,"StudyLevel": studentProfile[0].StudyLevel, "Faculty": studentFaculty[0][0].Faculty,"Department": studentProfile[0].Department, "role": "student","aucasaUserRole":aucasaUserRole[0].role }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '2h' })
                    const refreshToken = token.sign({ "Id": Id,"StudyLevel": studentProfile[0].StudyLevel, "Faculty": studentFaculty[0][0].Faculty,"Department":studentProfile[0].Department, "role": "student","aucasaUserRole":aucasaUserRole[0].role }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '15d' })
                    return res.status(200).send({ accessToken, refreshToken,studentProfile,aucasaUserRole });
                }
            }

        }

        if (UserType.toLowerCase() === "staff") {
            const [staffId] = await connectionPromise.query(`select Id from staff where Email=? AND Password=?`,[Id,Password])

            if (!staffId[0]) {
                return res.status(401).json("invalid user credentials")
            }
            else {
                const [staffProfile] = await connectionPromise.query(`select Id,Fname,Lname,Email,Department,Role,ProfileUrl from staff where Id=?`,[staffId[0].Id])
                const [staffDepartment] = await connectionPromise.query(`select Department from staff where Id=?`, [staffId[0].Id])
                const accessToken = token.sign({ "Id": staffId[0].Id, "Department": staffDepartment[0].Department, "role": "staff" }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '2h' })
                const refreshToken = token.sign({ "Id": staffId[0].Id, "Department": staffDepartment[0].Department, "role": "staff" }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '15d' })
                return res.status(200).send({ accessToken, refreshToken,staffProfile });
            }
        }
        else{
            return res.status(400).json("message: Invalid user type.")
        }
    }

    catch(err) {
        res.status(500).send(err)
    }

})

module.exports = router;