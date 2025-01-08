const express=require('express')
const router=express.Router()
const connectionPromise=require('../../database & models/databaseConnection')
const {Authenticate}=require('../../Authentication/authentication')

router.post('/',Authenticate,async(req,res)=>{
    const userId=req.user.Id;
    const {content,status,audience}=req.body;
    try{
        await connectionPromise.query(`insert into notifications(StaffId,Content,Status,Audience) values(?,?,?,?)`,[userId,content,status,audience]).then(
            res.json('notification sent successfully...')
            
        )
    }
    catch{(error)=>{
        console.log(error);
    }}
    



})