const express=require('express');
const router=express.Router();
const connectionPromise=require('../../../database & models/databaseConnection')
const {Authenticate}=require('../../../Authentication/authentication')

router.get('/',Authenticate,async(req,res)=>{
    const userId=req.user.studentId;
    try{
        const [classGroups]=connectionPromise.query(`select * from registration where StudentId=${userId}`).then(
            res.status(200).json(classGroups[0])
        )
    }
    catch{(err)=>{
        console.log(err)
    }}
})
module.exports=router;